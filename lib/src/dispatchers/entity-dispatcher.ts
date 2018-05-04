import { Injectable } from '@angular/core';
import { Action, Store } from '@ngrx/store';

import { EntityAction, EntityActionFactory } from '../actions/entity-action';
import { EntityActionGuard } from '../actions/entity-action-guard';
import { EntityOp } from '../actions/entity-op';
import { QueryParams } from '../dataservices/interfaces';
import { EntityCommands } from './entity-commands';
import { EntityCache } from '../reducers/entity-cache';
import { IdSelector, Update } from '../utils/ngrx-entity-models';
import { defaultSelectId, toUpdateFactory } from '../utils/utilities';

/**
 * Options controlling EntityDispatcher behavior
 * such as whether `add()` is optimistic or pessimistic
 */
export interface EntityDispatcherOptions {
  optimisticAdd: boolean;
  optimisticDelete: boolean;
  optimisticUpdate: boolean;
}

/**
 * Dispatches Entity-related commands to effects and reducers
 */
export interface EntityDispatcher<T> extends EntityCommands<T> {
  /** Name of the entity type */
  readonly entityName: string;

  /**
   * Utility class with methods to validate EntityAction payloads.
   */
  readonly guard: EntityActionGuard;

  /** Returns the primary key (id) of this entity */
  readonly selectId: IdSelector<T>;

  /** Returns the store, scoped to the EntityCache */
  readonly store: Store<EntityCache>;

  /**
   * Create an {EntityAction} for this entity type.
   * @param op {EntityOp} the entity operation
   * @param payload the action payload
   */
  createEntityAction(op: EntityOp, payload?: any): EntityAction;

  /**
   * Create an {EntityAction} for this entity type and
   * dispatch it immediately to the store.
   * @param op {EntityOp} the entity operation
   * @param payload the action payload
   */
  createAndDispatch(op: EntityOp, payload?: any): void;

  /**
   * Dispatch action to the store.
   * @param action the Action
   */
  dispatch(action: Action): void;

  /**
   * Convert an entity (or partial entity) into the `Update<T>` object
   * `update...` and `upsert...` methods take `Update<T>` args
   */
  toUpdate(entity: Partial<T>): Update<T>;
}

export class EntityDispatcherBase<T> implements EntityDispatcher<T> {
  /**
   * Utility class with methods to validate EntityAction payloads.
   */
  guard: EntityActionGuard;

  /**
   * Convert an entity (or partial entity) into the `Update<T>` object
   * `update...` and `upsert...` methods take `Update<T>` args
   */
  toUpdate: (entity: Partial<T>) => Update<T>;

  constructor(
    /** Name of the entity type for which entities are dispatched */
    public entityName: string,
    /** Creates an {EntityAction} */
    public entityActionFactory: EntityActionFactory,
    /** The store, scoped to the EntityCache */
    public store: Store<EntityCache>,
    /** Returns the primary key (id) of this entity */
    public selectId: IdSelector<T> = defaultSelectId,
    /**
     * Dispatcher options configure dispatcher behavior such as
     * whether add is optimistic or pessimistic.
     */
    public options: EntityDispatcherOptions
  ) {
    this.guard = new EntityActionGuard(selectId);
    this.toUpdate = toUpdateFactory<T>(selectId);
  }

  /**
   * Create an {EntityAction} for this entity type.
   * @param op {EntityOp} the entity operation
   * @param payload the action payload
   */
  createEntityAction(op: EntityOp, payload?: any): EntityAction {
    return this.entityActionFactory.create<T>(this.entityName, op, payload);
  }

  /**
   * Create an {EntityAction} for this entity type and
   * dispatch it immediately to the store.
   * @param op {EntityOp} the entity operation
   * @param payload the action payload
   */
  createAndDispatch(op: EntityOp, payload?: any): void {
    const action = this.createEntityAction(op, payload);
    this.dispatch(action);
  }

  /**
   * Dispatch {EntityAction} to the store.
   * @param action the EntityAction
   */
  dispatch(action: Action): void {
    this.store.dispatch(action);
  }

  /**
   * Save a new entity to remote storage.
   * Does not add to cache until save succeeds.
   * Ignored by cache-add if the entity is already in cache.
   */
  add(entity: T, isOptimistic?: boolean): void {
    isOptimistic =
      isOptimistic != null ? isOptimistic : this.options.optimisticAdd;
    const op = isOptimistic
      ? EntityOp.SAVE_ADD_ONE_OPTIMISTIC
      : EntityOp.SAVE_ADD_ONE;

    const action = this.createEntityAction(op, entity);
    if (isOptimistic) {
      this.guard.mustBeEntity(action);
    }
    this.dispatch(action);
  }

  /**
   * Removes entity from the cache (if it is in the cache)
   * and deletes entity from remote storage by key.
   * Does not restore to cache if the delete fails.
   * @param entity The entity to remove
   */
  delete(entity: T, isOptimistic?: boolean): void;

  /**
   * Removes entity from the cache by key (if it is in the cache)
   * and deletes entity from remote storage by key.
   * Does not restore to cache if the delete fails.
   * @param key The primary key of the entity to remove
   */
  delete(key: number | string, isOptimistic?: boolean): void;
  delete(arg: (number | string) | T, isOptimistic?: boolean): void {
    const op = (isOptimistic != null
    ? isOptimistic
    : this.options.optimisticDelete)
      ? EntityOp.SAVE_DELETE_ONE_OPTIMISTIC
      : EntityOp.SAVE_DELETE_ONE;
    const key = this.getKey(arg);
    const action = this.createEntityAction(op, key);
    this.guard.mustBeKey(action);
    this.dispatch(action);
  }

  /**
   * Query remote storage for all entities and
   * completely replace the cached collection with the queried entities.
   */
  getAll(): void {
    this.createAndDispatch(EntityOp.QUERY_ALL);
  }

  /**
   * Query remote storage for the entity with this primary key.
   * If the server returns an entity,
   * merge it into the cached collection.
   */
  getByKey(key: any): void {
    this.createAndDispatch(EntityOp.QUERY_BY_KEY, key);
  }

  /**
   * Query remote storage for the entities that satisfy a query expressed
   * with either a query parameter map or an HTTP URL query string.
   * and merge the results into the cached collection.
   */
  getWithQuery(queryParams: QueryParams | string): void {
    this.createAndDispatch(EntityOp.QUERY_MANY, queryParams);
  }

  /**
   * Save the updated entity (or partial entity) to remote storage.
   * Updates the cached entity after the save succeeds.
   * Update in cache is ignored if the entity's key is not found in cache.
   * The update entity may be partial (but must have its key)
   * in which case it patches the existing entity.
   */
  update(entity: Partial<T>, isOptimistic?: boolean): void {
    // update entity might be a partial of T but must at least have its key.
    // pass the Update<T> structure as the payload
    const update: Update<T> = this.toUpdate(entity);
    const op = (isOptimistic != null
    ? isOptimistic
    : this.options.optimisticUpdate)
      ? EntityOp.SAVE_UPDATE_ONE_OPTIMISTIC
      : EntityOp.SAVE_UPDATE_ONE;

    const action = this.createEntityAction(op, update);
    this.guard.mustBeUpdate(action);
    this.dispatch(action);
  }

  /*** Cache-only operations that do not update remote storage ***/

  // Unguarded for performance.
  // EntityCollectionReducer<T> runs a guard (which throws)
  // Developer should understand cache-only methods well enough
  // to call them with the proper entities.
  // May reconsider and add guards in future.

  /**
   * Replace all entities in the cached collection.
   * Does not save to remote storage.
   */
  addAllToCache(entities: T[]): void {
    this.createAndDispatch(EntityOp.ADD_ALL, entities);
  }

  /**
   * Add a new entity directly to the cache.
   * Does not save to remote storage.
   * Ignored if an entity with the same primary key is already in cache.
   */
  addOneToCache(entity: T): void {
    this.createAndDispatch(EntityOp.ADD_ONE, entity);
  }

  /**
   * Add multiple new entities directly to the cache.
   * Does not save to remote storage.
   * Entities with primary keys already in cache are ignored.
   */
  addManyToCache(entities: T[]): void {
    this.createAndDispatch(EntityOp.ADD_MANY, entities);
  }

  /** Clear the cached entity collection */
  clearCache(): void {
    this.createAndDispatch(EntityOp.REMOVE_ALL);
  }

  /**
   * Remove an entity directly from the cache.
   * Does not delete that entity from remote storage.
   * @param entity The entity to remove
   */
  removeOneFromCache(entity: T): void;

  /**
   * Remove an entity directly from the cache.
   * Does not delete that entity from remote storage.
   * @param key The primary key of the entity to remove
   */
  removeOneFromCache(key: number | string): void;
  removeOneFromCache(arg: (number | string) | T): void {
    this.createAndDispatch(EntityOp.REMOVE_ONE, this.getKey(arg));
  }

  /**
   * Remove multiple entities directly from the cache.
   * Does not delete these entities from remote storage.
   * @param entity The entities to remove
   */
  removeManyFromCache(entities: T[]): void;

  /**
   * Remove multiple entities directly from the cache.
   * Does not delete these entities from remote storage.
   * @param keys The primary keys of the entities to remove
   */
  removeManyFromCache(keys: (number | string)[]): void;
  removeManyFromCache(args: (number | string)[] | T[]): void {
    if (!args || args.length === 0) {
      return;
    }
    const keys =
      typeof args[0] === 'object'
        ? // if array[0] is a key, assume they're all keys
          (<T[]>args).map(arg => this.getKey(arg))
        : args;
    this.createAndDispatch(EntityOp.REMOVE_MANY, keys);
  }

  /**
   * Update a cached entity directly.
   * Does not update that entity in remote storage.
   * Ignored if an entity with matching primary key is not in cache.
   * The update entity may be partial (but must have its key)
   * in which case it patches the existing entity.
   */
  updateOneInCache(entity: Partial<T>): void {
    // update entity might be a partial of T but must at least have its key.
    // pass the Update<T> structure as the payload
    const update: Update<T> = this.toUpdate(entity);
    this.createAndDispatch(EntityOp.UPDATE_ONE, update);
  }

  /**
   * Update multiple cached entities directly.
   * Does not update these entities in remote storage.
   * Entities whose primary keys are not in cache are ignored.
   * Update entities may be partial but must at least have their keys.
   * such partial entities patch their cached counterparts.
   */
  updateManyInCache(entities: Partial<T>[]): void {
    if (!entities || entities.length === 0) {
      return;
    }
    const updates: Update<T>[] = entities.map(entity => this.toUpdate(entity));
    this.createAndDispatch(EntityOp.UPDATE_MANY, updates);
  }

  /**
   * Add or update a new entity directly to the cache.
   * Does not save to remote storage.
   * Upsert entity might be a partial of T but must at least have its key.
   * Pass the Update<T> structure as the payload
   */
  upsertOneInCache(entity: Partial<T>): void {
    const upsert: Update<T> = this.toUpdate(entity);
    this.createAndDispatch(EntityOp.UPSERT_ONE, upsert);
  }

  /**
   * Add or update multiple cached entities directly.
   * Does not save to remote storage.
   */
  upsertManyInCache(entities: Partial<T>[]): void {
    if (!entities || entities.length === 0) {
      return;
    }
    const upserts: Update<T>[] = entities.map(entity => this.toUpdate(entity));
    this.createAndDispatch(EntityOp.UPSERT_MANY, upserts);
  }

  /**
   * Set the pattern that the collection's filter applies
   * when using the `filteredEntities` selector.
   */
  setFilter(pattern: any): void {
    this.createAndDispatch(EntityOp.SET_FILTER, pattern);
  }

  /** Set the loaded flag */
  setLoaded(isLoaded: boolean): void {
    this.createAndDispatch(EntityOp.SET_LOADED, !!isLoaded);
  }

  /** Set the loading flag */
  setLoading(isLoading: boolean): void {
    this.createAndDispatch(EntityOp.SET_LOADED, !!isLoading);
  }

  /** Get key from entity (unless arg is already a key) */
  private getKey(arg: number | string | T) {
    return typeof arg === 'object' ? this.selectId(arg) : arg;
  }
}
