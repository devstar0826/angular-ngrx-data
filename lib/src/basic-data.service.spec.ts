import { TestBed } from '@angular/core/testing';

import { HttpClient, HttpResponse } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { BasicDataService } from './basic-data.service';
import { DataServiceError } from './interfaces';
import { Update } from './ngrx-entity-models';

class Hero {
  id: number;
  name: string;
  version?: number;
}

const testServiceConfig = {
  api: 'api',
  entityName: 'Hero',
  entitiesName: 'Heroes'
};

////////  Tests  /////////////
describe('BasicDataService', () => {

  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  const heroUrl = 'api/hero/';
  const heroesUrl = 'api/heroes/';
  let service: BasicDataService<Hero>;

  //// HttpClient testing boilerplate
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ HttpClientTestingModule ]
    });
    httpClient = TestBed.get(HttpClient);
    httpTestingController = TestBed.get(HttpTestingController);
  });

  afterEach(() => {
    // After every test, assert that there are no pending requests.
    httpTestingController.verify();
  });
  ///////////////////

  describe('property inspection', () => {

    // Test wrapper exposes protected properties
    class TestService<T> extends BasicDataService<T> {
      properties = {
        entityUrl: this.entityUrl,
        entitiesUrl: this.entitiesUrl,
        getDelay: this.getDelay,
        saveDelay: this.saveDelay,
        timeout: this.timeout
      }
    }

    // tslint:disable-next-line:no-shadowed-variable
    let service: TestService<Hero>;

    beforeEach(() => {
      // use test wrapper class to get to protected properties
      service = new TestService(httpClient, testServiceConfig);
    });

    it('has expected name', () => {
      expect(service.name).toBe('Hero BasicDataService');
    });

    it('has expected single-entity url', () => {
      expect(service.properties.entityUrl).toBe(heroUrl);
    });

    it('has expected multiple-entities url', () => {
      expect(service.properties.entitiesUrl).toBe(heroesUrl);
    });
  });

  describe('#getAll', () => {
    let expectedHeroes: Hero[];

    beforeEach(() => {
      service = new BasicDataService(httpClient, testServiceConfig);
      expectedHeroes = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
       ] as Hero[];
    });

    it('should return expected heroes (called once)', () => {

      service.getAll().subscribe(
        heroes => expect(heroes).toEqual(expectedHeroes, 'should return expected heroes'),
        fail
      );

      // HeroService should have made one request to GET heroes from expected URL
      const req = httpTestingController.expectOne(heroesUrl);
      expect(req.request.method).toEqual('GET');

      // Respond with the mock heroes
      req.flush(expectedHeroes);
    });

    it('should be OK returning no heroes', () => {

      service.getAll().subscribe(
        heroes => expect(heroes.length).toEqual(0, 'should have empty heroes array'),
        fail
      );

      const req = httpTestingController.expectOne(heroesUrl);
      req.flush([]); // Respond with no heroes
    });

    it('should return expected heroes (called multiple times)', () => {

      service.getAll().subscribe();
      service.getAll().subscribe();
      service.getAll().subscribe(
        heroes => expect(heroes).toEqual(expectedHeroes, 'should return expected heroes'),
        fail
      );

      const requests = httpTestingController.match(heroesUrl);
      expect(requests.length).toEqual(3, 'calls to getAll()');

      // Respond to each request with different mock hero results
      requests[0].flush([]);
      requests[1].flush([{id: 1, name: 'bob'}]);
      requests[2].flush(expectedHeroes);
    });

    it('should turn 404 into Observable<DataServiceError>', () => {

      const msg = 'deliberate 404 error';

      service.getAll().subscribe(
        heroes => fail('getAll succeeded when expected it to fail with a 404'),
        err => {
          expect(err).toBeDefined('request should have failed');
          expect(err instanceof DataServiceError).toBe(true, 'is DataServiceError');
          expect(err.error.status).toEqual(404, 'has 404 status');
          expect(err.message).toEqual(msg, 'has expected error message');
        }
      );

      const req = httpTestingController.expectOne(heroesUrl);

      const errorEvent = new ErrorEvent('so sad', {
        // Source of the service's not-so-friendly user-facing message
        message: msg,

        // The rest of this is optional and not used. Just showing that you could.
        filename: 'BasicDataService.ts',
        lineno: 42,
        colno: 21
      });

      req.error(errorEvent, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('#getById', () => {

    let expectedHero: Hero;
    const heroUrlId1 = heroUrl + '1';

    beforeEach(() => {
      service = new BasicDataService(httpClient, testServiceConfig);
    });

    it('should return expected hero when id is found', () => {
      expectedHero = { id: 1, name: 'A' };

      service.getById(1).subscribe(
        hero => expect(hero).toEqual(expectedHero, 'should return expected hero'),
        fail
      );

      // One request to GET hero from expected URL
      const req = httpTestingController.expectOne(heroUrlId1);

      // Respond with the expected hero
      req.flush(expectedHero);
    });

    it('should turn 404 when id not found', () => {

      service.getById(1).subscribe(
        heroes => fail('getById succeeded when expected it to fail with a 404'),
        err => {
          expect(err instanceof DataServiceError).toBe(true);
        }
      );

      const req = httpTestingController.expectOne(heroUrlId1);
      const errorEvent = new ErrorEvent('so sad', { message: 'boom!'});
      req.error(errorEvent, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('#add', () => {
    let expectedHero: Hero;

    beforeEach(() => {
      service = new BasicDataService(httpClient, testServiceConfig);
    });

    it('should return expected hero with id', () => {
      expectedHero = {id: 42, name: 'A' };

      service.add({ name: 'A' } as Hero).subscribe(
        hero => expect(hero).toEqual(expectedHero, 'should return expected hero'),
        fail
      );

      // One request to POST hero from expected URL
      const req = httpTestingController.expectOne(
        r => r.method === 'POST' && r.url === heroUrl);

      // Respond with the expected hero
      req.flush(expectedHero);
    });
  });

  describe('#delete', () => {
    const heroUrlId1 = heroUrl + '1';

    beforeEach(() => {
      service = new BasicDataService(httpClient, testServiceConfig);
    });

    it('should delete by hero id', () => {
      service.delete(1).subscribe(
        result => expect(result).toEqual({}, 'should return nothing'),
        fail
      );

     // One request to DELETE hero from expected URL
     const req = httpTestingController.expectOne(
        r => r.method === 'DELETE' && r.url === heroUrlId1);

      // Respond with empty nonsense object
      req.flush({});
    });

    it('should turn 404 when id not found', () => {
      service.delete(1).subscribe(
        heroes => fail('delete succeeded when expected it to fail with a 404'),
        err => {
          expect(err instanceof DataServiceError).toBe(true);
        }
      );

      const req = httpTestingController.expectOne(heroUrlId1);
      const errorEvent = new ErrorEvent('so sad', { message: 'boom!'});
      req.error(errorEvent, { status: 404, statusText: 'Not Found' });
    });
  });


  describe('#update', () => {
    const heroUrlId1 = heroUrl + '1';

    beforeEach(() => {
      service = new BasicDataService(httpClient, testServiceConfig);
    });

    it('should return expected hero with id', () => {
      // Assume that server updates the version
      const expectedHero: Hero =
        ({ id: 1, name: 'B', version: 2 });

      // Should return an Update<T>
      const expectedUpdate: Update<Hero> =
        ({ id: 1, changes: expectedHero});

      // Call service.update with an Update<T> arg
      const updateArg: Update<Hero> = {
        id: 1,
        changes: { id: 1, name: 'B' }
      };

      service.update(updateArg).subscribe(
        updated => expect(updated).toEqual(expectedUpdate, 'should return expected hero update'),
        fail
      );

      // One request to PUT hero from expected URL
      const req = httpTestingController.expectOne(
        r => r.method === 'PUT' && r.url === heroUrlId1);

      // Respond with the expected hero
      req.flush(expectedHero);
    });

    it('should turn 404 when id not found', () => {

      service.update({ id: 1, changes: { id: 1, name: 'B' } }).subscribe(
        update => fail('update succeeded when expected it to fail with a 404'),
        err => {
          expect(err instanceof DataServiceError).toBe(true);
        }
      );

      const req = httpTestingController.expectOne(heroUrlId1);
      const errorEvent = new ErrorEvent('so sad', { message: 'boom!'});
      req.error(errorEvent, { status: 404, statusText: 'Not Found' });
    });
  });
});
