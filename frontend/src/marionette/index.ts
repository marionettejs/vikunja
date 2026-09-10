import {CollectionView as BaseCollectionView, View as BaseView} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {DataApi, StateApi} from '@mnjs/data'

export const View = BaseView.extend()
View.setDataApi(DataApi)
View.setStateApi(StateApi)
View.setDomApi(LitDomApi)

export const CollectionView = BaseCollectionView.extend()
CollectionView.setDataApi(DataApi)
CollectionView.setStateApi(StateApi)
