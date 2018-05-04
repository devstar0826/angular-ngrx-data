import { Injectable } from '@angular/core';

import { Observable } from 'rxjs/Observable';

import { EntityAction } from '../actions/entity-action';
import { DefaultDataServiceFactory } from './default-data.service';
import { HttpUrlGenerator } from './http-url-generator';
import { QueryParams } from './interfaces';
import { Update } from '../utils/ngrx-entity-models';

/** A service that performs REST-like HTTP data operations */
export interface EntityCollectionDataService<T> {
  readonly name: string;
  add(entity: T): Observable<T>;
  delete(id: any): Observable<null>;
  getAll(): Observable<T[]>;
  getById(id: any): Observable<T>;
  getWithQuery(params: QueryParams | string): Observable<T[]>;
  update(update: Update<T>): Observable<Update<T>>;
}

@Injectable()
export class EntityDataService {
  protected services: { [name: string]: EntityCollectionDataService<any> } = {};

  // TODO:  Optionally inject specialized entity data services
  // for those that aren't derived from BaseDataService.
  constructor(protected defaultDataServiceFactory: DefaultDataServiceFactory) {}

  /**
   * Get (or create) a data service for entity type
   * @param entityName - the name of the type
   *
   * Examples:
   *   getService('Hero'); // data service for Heroes, untyped
   *   getService<Hero>('Hero'); // data service for Heroes, typed as Hero
   */
  getService<T>(entityName: string): EntityCollectionDataService<T> {
    entityName = entityName.trim();
    let service = this.services[entityName];
    if (!service) {
      service = this.defaultDataServiceFactory.create(entityName);
      this.services[entityName] = service;
    }
    return service;
  }

  /**
   * Register an EntityCollectionDataService for an entity type
   * @param entityName - the name of the entity type
   * @param service - data service for that entity type
   *
   * Examples:
   *   registerService('Hero', myHeroDataService);
   *   registerService('Villain', myVillainDataService);
   */
  registerService<T>(
    entityName: string,
    service: EntityCollectionDataService<T>
  ) {
    this.services[entityName.trim()] = service;
  }

  /**
   * Register a batch of data services.
   * @param services - data services to merge into existing services
   *
   * Examples:
   *   registerServices({
   *     Hero: myHeroDataService,
   *     Villain: myVillainDataService
   *   });
   */
  registerServices(services: {
    [name: string]: EntityCollectionDataService<any>;
  }) {
    this.services = { ...this.services, ...services };
  }
}
