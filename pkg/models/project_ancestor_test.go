// Vikunja is a to-do list application to facilitate your life.
// Copyright 2018-present Vikunja and contributors. All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package models

import (
	"testing"

	"code.vikunja.io/api/pkg/db"
	"code.vikunja.io/api/pkg/user"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"xorm.io/builder"
	"xorm.io/xorm"
)

func allProjectAncestors(t *testing.T, s *xorm.Session) []ProjectAncestor {
	t.Helper()
	rows := []ProjectAncestor{}
	require.NoError(t, s.OrderBy("project_id, ancestor_id").Find(&rows))
	return rows
}

func projectAncestorsOf(t *testing.T, s *xorm.Session, projectIDs ...int64) []ProjectAncestor {
	t.Helper()
	rows := []ProjectAncestor{}
	require.NoError(t, s.Where(builder.In("project_id", projectIDs)).Find(&rows))
	return rows
}

func TestProjectAncestorsFixtureMatchesProjects(t *testing.T) {
	db.LoadAndAssertFixtures(t)
	s := db.NewSession()
	defer s.Close()

	fromFixture := allProjectAncestors(t, s)
	require.NoError(t, RebuildProjectAncestors(s))
	rebuilt := allProjectAncestors(t, s)

	assert.ElementsMatch(t, fromFixture, rebuilt)
}

func TestProjectAncestorsOnCreate(t *testing.T) {
	usr := &user.User{ID: 6, Username: "user6"}

	t.Run("top level project", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		project := &Project{Title: "new top level"}
		require.NoError(t, project.Create(s, usr))

		assert.ElementsMatch(t, []ProjectAncestor{
			{ProjectID: project.ID, AncestorID: project.ID, Depth: 0},
		}, projectAncestorsOf(t, s, project.ID))
	})

	t.Run("child of a project with ancestors", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		// 26 -> 25 -> 12 -> 27
		project := &Project{Title: "new child", ParentProjectID: Ptr(int64(26))}
		require.NoError(t, project.Create(s, usr))

		assert.ElementsMatch(t, []ProjectAncestor{
			{ProjectID: project.ID, AncestorID: project.ID, Depth: 0},
			{ProjectID: project.ID, AncestorID: 26, Depth: 1},
			{ProjectID: project.ID, AncestorID: 25, Depth: 2},
			{ProjectID: project.ID, AncestorID: 12, Depth: 3},
			{ProjectID: project.ID, AncestorID: 27, Depth: 4},
		}, projectAncestorsOf(t, s, project.ID))
	})
}

func TestProjectAncestorsOnMove(t *testing.T) {
	usr := &user.User{ID: 6, Username: "user6"}

	reparent := func(t *testing.T, s *xorm.Session, projectID, newParentID int64) {
		t.Helper()
		project, err := GetProjectSimpleByID(s, projectID)
		require.NoError(t, err)
		project.ParentProjectID = Ptr(newParentID)
		require.NoError(t, UpdateProject(s, project, usr, false))
	}

	t.Run("subtree under another parent", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		// 26 -> 25 -> 12 -> 27, moving 12 under 28
		reparent(t, s, 12, 28)

		assert.ElementsMatch(t, []ProjectAncestor{
			{ProjectID: 12, AncestorID: 12, Depth: 0},
			{ProjectID: 12, AncestorID: 28, Depth: 1},
			{ProjectID: 25, AncestorID: 25, Depth: 0},
			{ProjectID: 25, AncestorID: 12, Depth: 1},
			{ProjectID: 25, AncestorID: 28, Depth: 2},
			{ProjectID: 26, AncestorID: 26, Depth: 0},
			{ProjectID: 26, AncestorID: 25, Depth: 1},
			{ProjectID: 26, AncestorID: 12, Depth: 2},
			{ProjectID: 26, AncestorID: 28, Depth: 3},
		}, projectAncestorsOf(t, s, 12, 25, 26))
	})

	t.Run("subtree to the top level", func(t *testing.T) {
		db.LoadAndAssertFixtures(t)
		s := db.NewSession()
		defer s.Close()

		reparent(t, s, 12, 0)

		assert.ElementsMatch(t, []ProjectAncestor{
			{ProjectID: 12, AncestorID: 12, Depth: 0},
			{ProjectID: 25, AncestorID: 25, Depth: 0},
			{ProjectID: 25, AncestorID: 12, Depth: 1},
			{ProjectID: 26, AncestorID: 26, Depth: 0},
			{ProjectID: 26, AncestorID: 25, Depth: 1},
			{ProjectID: 26, AncestorID: 12, Depth: 2},
		}, projectAncestorsOf(t, s, 12, 25, 26))
	})
}

func TestProjectAncestorsOnDelete(t *testing.T) {
	db.LoadAndAssertFixtures(t)
	s := db.NewSession()
	defer s.Close()

	usr := &user.User{ID: 6, Username: "user6"}

	// 12 has 25 as child and 26 as grandchild
	project, err := GetProjectSimpleByID(s, 12)
	require.NoError(t, err)
	require.NoError(t, project.Delete(s, usr))

	rows := allProjectAncestors(t, s)
	for _, row := range rows {
		assert.NotContains(t, []int64{12, 25, 26}, row.ProjectID)
		assert.NotContains(t, []int64{12, 25, 26}, row.AncestorID)
	}
}

func TestProjectAncestorsOnRepair(t *testing.T) {
	db.LoadAndAssertFixtures(t)
	s := db.NewSession()
	defer s.Close()

	// 12 -> 27, dropping 27 orphans the whole subtree below 12
	_, err := s.ID(27).Delete(&Project{})
	require.NoError(t, err)

	_, err = RepairOrphanedProjects(s, false)
	require.NoError(t, err)

	assert.ElementsMatch(t, []ProjectAncestor{
		{ProjectID: 12, AncestorID: 12, Depth: 0},
		{ProjectID: 25, AncestorID: 25, Depth: 0},
		{ProjectID: 25, AncestorID: 12, Depth: 1},
		{ProjectID: 26, AncestorID: 26, Depth: 0},
		{ProjectID: 26, AncestorID: 25, Depth: 1},
		{ProjectID: 26, AncestorID: 12, Depth: 2},
	}, projectAncestorsOf(t, s, 12, 25, 26))
}
