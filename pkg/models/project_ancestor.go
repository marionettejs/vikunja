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
	"fmt"
	"slices"

	"xorm.io/builder"
	"xorm.io/xorm"
)

// ProjectAncestor holds one row per project and each of its ancestors including itself,
// so the tree resolves with a join instead of a recursive walk. Depth 0 is the project itself.
type ProjectAncestor struct {
	ProjectID  int64 `xorm:"bigint not null pk"`
	AncestorID int64 `xorm:"bigint not null pk index"`
	Depth      int64 `xorm:"int not null"`
}

func (*ProjectAncestor) TableName() string {
	return "project_ancestors"
}

const projectAncestorInsertBatch = 500

func insertProjectAncestorRows(s *xorm.Session, rows []*ProjectAncestor) error {
	for chunk := range slices.Chunk(rows, projectAncestorInsertBatch) {
		if _, err := s.Insert(chunk); err != nil {
			return fmt.Errorf("could not insert project ancestors: %w", err)
		}
	}
	return nil
}

func getProjectAncestorRows(s *xorm.Session, cond builder.Cond) (rows []*ProjectAncestor, err error) {
	rows = []*ProjectAncestor{}
	if err := s.Where(cond).Find(&rows); err != nil {
		return nil, fmt.Errorf("could not get project ancestors: %w", err)
	}
	return rows, nil
}

func insertProjectAncestors(s *xorm.Session, projectID, parentID int64) error {
	rows := []*ProjectAncestor{{ProjectID: projectID, AncestorID: projectID}}

	if parentID != 0 {
		parentRows, err := getProjectAncestorRows(s, builder.Eq{"project_id": parentID})
		if err != nil {
			return err
		}
		for _, parent := range parentRows {
			rows = append(rows, &ProjectAncestor{
				ProjectID:  projectID,
				AncestorID: parent.AncestorID,
				Depth:      parent.Depth + 1,
			})
		}
	}

	return insertProjectAncestorRows(s, rows)
}

// moveProjectAncestors re-links the whole subtree of projectID to newParentID (0 = top level).
func moveProjectAncestors(s *xorm.Session, projectID, newParentID int64) error {
	subtree, err := getProjectAncestorRows(s, builder.Eq{"ancestor_id": projectID})
	if err != nil {
		return err
	}

	subtreeIDs := make([]int64, 0, len(subtree))
	for _, row := range subtree {
		subtreeIDs = append(subtreeIDs, row.ProjectID)
	}

	_, err = s.
		Where(builder.In("project_id", subtreeIDs).And(builder.NotIn("ancestor_id", subtreeIDs))).
		Delete(&ProjectAncestor{})
	if err != nil {
		return fmt.Errorf("could not delete old project ancestors of project %d: %w", projectID, err)
	}

	if newParentID == 0 {
		return nil
	}

	parentRows, err := getProjectAncestorRows(s, builder.Eq{"project_id": newParentID})
	if err != nil {
		return err
	}

	rows := make([]*ProjectAncestor, 0, len(subtree)*len(parentRows))
	for _, descendant := range subtree {
		for _, ancestor := range parentRows {
			rows = append(rows, &ProjectAncestor{
				ProjectID:  descendant.ProjectID,
				AncestorID: ancestor.AncestorID,
				Depth:      descendant.Depth + 1 + ancestor.Depth,
			})
		}
	}

	return insertProjectAncestorRows(s, rows)
}

// deleteProjectAncestors removes every row mentioning the project, in either column.
func deleteProjectAncestors(s *xorm.Session, projectID int64) error {
	_, err := s.
		Where(builder.Or(builder.Eq{"project_id": projectID}, builder.Eq{"ancestor_id": projectID})).
		Delete(&ProjectAncestor{})
	if err != nil {
		return fmt.Errorf("could not delete project ancestors of project %d: %w", projectID, err)
	}
	return nil
}

func RebuildProjectAncestors(s *xorm.Session) error {
	_, err := s.Where(builder.Gt{"project_id": 0}).Delete(&ProjectAncestor{})
	if err != nil {
		return fmt.Errorf("could not delete project ancestors: %w", err)
	}

	projects := []*Project{}
	if err := s.Table(&Project{}).Cols("id", "parent_project_id").Find(&projects); err != nil {
		return fmt.Errorf("could not get projects: %w", err)
	}

	parents := make(map[int64]int64, len(projects))
	for _, project := range projects {
		parents[project.ID] = project.parentID()
	}

	rows := make([]*ProjectAncestor, 0, len(projects))
	for _, project := range projects {
		rows = append(rows, &ProjectAncestor{ProjectID: project.ID, AncestorID: project.ID})

		visited := map[int64]bool{project.ID: true}
		depth := int64(0)
		for current := parents[project.ID]; current != 0; current = parents[current] {
			// A missing parent or a cycle ends the chain: the remaining links are treated
			// as absent so the rows still describe a tree.
			if _, exists := parents[current]; !exists || visited[current] {
				break
			}
			visited[current] = true
			depth++
			rows = append(rows, &ProjectAncestor{ProjectID: project.ID, AncestorID: current, Depth: depth})
		}
	}

	return insertProjectAncestorRows(s, rows)
}
