import { EntityMetadata } from './entity-metadata';
import { EntityFilterFn } from './entity-filters';
import { IdSelector, Comparer } from './ngrx-entity-models';
import { EntityCollectionReducer } from './entity.reducer';
import { createEntitySelectors, EntitySelectors } from './entity.selectors';

import { createEntityDefinition } from './entity-definition';

interface Hero {
  id: number,
  name: string
}

interface NonIdClass {
  key: string;
  something: any
}

const sorter = <T>(a: T, b: T) => 'foo';

const filter = <T>(entities: T[], pattern?: any) => entities;

const selectIdForNonId = (entity: Partial<NonIdClass>) => entity.key;

const HERO_METADATA: EntityMetadata<Hero> = {
  entityName: 'Hero',
  sortComparer: sorter,
  filterFn: filter
};

describe('Entity Definition', () => {

  let heroMetadata: EntityMetadata<Hero>;

  describe('#createEntityDefinition', () => {

    beforeEach(() => {
      heroMetadata = { ...HERO_METADATA };
    })

    it('generates expected `initialState`', () => {
      const def = createEntityDefinition(heroMetadata);
      const initialState = def.initialState;
      expect(initialState).toEqual({
        ids: [],
        entities: {},
        filter: '',
        loading: false
      })
    });

    it('generates expected `initialState` when `additionalCollectionState`', () => {
      // extend Hero collection metadata with more collection state
      const metadata = { ...heroMetadata, additionalCollectionState: { foo: 'foo'} };
      const def = createEntityDefinition(metadata);
      const initialState = def.initialState;
      expect(initialState).toEqual(<any> {
        ids: [],
        entities: {},
        filter: '',
        loading: false,
        foo: 'foo'
      })
    });

    it('creates default `selectId` on the definition when no metadata.selectId', () => {
      const def = createEntityDefinition(heroMetadata);
      expect(def.selectId({id: 42})).toBe(42);
    });

    it('creates expected `selectId` on the definition when  metadata.selectId exists', () => {
      const metadata: EntityMetadata =
        ({ entityName: 'NonIdClass', selectId: selectIdForNonId });
      const def = createEntityDefinition(metadata);
      expect(def.selectId({key: 'foo'})).toBe('foo');
    });

    it('sets `sortComparer` to false if not in metadata', () => {
      delete heroMetadata.sortComparer;
      const def = createEntityDefinition(heroMetadata);
      expect(def.metadata.sortComparer).toBe(false);
    });

    it('creates expected reducer', () => {
      const def = createEntityDefinition(heroMetadata);
      expect(def.reducer.toString()).toContain('function entityCollectionReducer');
    });

    it('creates expected selectors', () => {
      const def = createEntityDefinition(heroMetadata);
      const expectedSelectors = createEntitySelectors(def.metadata);
      expect(Object.keys(def.selectors)).toEqual(
        Object.keys(expectedSelectors));
    });

    it('throws error if missing `entityName`', () => {
      const metadata: EntityMetadata = <any> {};
      expect(() => createEntityDefinition(metadata)).toThrowError(/entityName/);
    });

  })

});
