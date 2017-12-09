import { Component, OnInit, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { debounceTime, distinctUntilChanged, skip, takeUntil } from 'rxjs/operators';

import { Hero } from '../core';
import { HeroDispatchers, HeroSelectors } from '../store/services';
import { AppSelectors } from '../store/app-config';

@Component({
  selector: 'app-hero-list',
  template: `
    <div>
      <form [formGroup]="form">
      <div class="button-group">
          <button type="button" (click)="getHeroes()">Refresh</button>
          <button type="button" (click)="enableAddMode()" *ngIf="!addingHero && !selectedHero">Add</button>
        </div>
        <div>
          <p>Filter the heroes</p>
          <input formControlName="filter" (input)="setFilter(form)"/>
        </div>
        <div *ngIf="filteredHeroes$ | async as heroes">
          <div *ngIf="loading$ | async;else heroList">Loading</div>
          <ng-template #heroList>
            <ul class="heroes">
              <li *ngFor="let hero of heroes"
                class="hero-container"
                [class.selected]="hero === selectedHero">
                <div class="hero-element">
                  <div class="badge">{{hero.id}}</div>
                  <div class="hero-text" (click)="onSelect(hero)">
                    <div class="name">{{hero.name}}</div>
                    <div class="saying">{{hero.saying}}</div>
                  </div>
                </div>
                <button class="delete-button" (click)="deleteHero(hero)">Delete</button>
              </li>
            </ul>
          </ng-template>
        </div>
      </form>

      <ng-template #elseTemplate>Loading ...</ng-template>
      <app-hero-detail
        *ngIf="selectedHero || addingHero"
        [hero]="selectedHero"
        (unselect)="unselect()"
        (add)="add($event)"
        (update)="update($event)">
      </app-hero-detail>
    </div>
  `,
  styleUrls: ['./hero-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeroListComponent implements OnDestroy, OnInit {
  addingHero = false;
  selectedHero: Hero = null;

  filteredHeroes$: Observable<Hero[]>;
  loading$: Observable<boolean>;
  filter$: Observable<string>;
  dataSource$ = this.appSelectors.dataSource$();
  form = this.fb.group({
    filter: [''],
  });

  private onDestroy = new Subject();

  constructor(
    private fb: FormBuilder,
    private heroDispatchers: HeroDispatchers,
    private heroSelectors: HeroSelectors,
    private appSelectors: AppSelectors
  ) {}

  ngOnInit() {
    this.filteredHeroes$ = this.heroSelectors.filteredHeroes$();
    this.loading$ = this.heroSelectors.loading$();
    this.filter$ = this.heroSelectors.filter$();

    this.dataSource$
      .pipe(takeUntil(this.onDestroy), distinctUntilChanged())
      .subscribe((val: string) => this.getHeroes());

    this.filter$
      .pipe(takeUntil(this.onDestroy), debounceTime(500), distinctUntilChanged())
      .subscribe((val: string) => this.filterHeroes());
  }

  ngOnDestroy() {
    this.onDestroy.next(true);
  }

  setFilter(form: FormGroup) {
    const { value, valid, touched } = form;
    if (valid) {
      this.heroDispatchers.setFilter(value.filter);
    }
    this.clear();
  }

  clear() {
    this.addingHero = false;
    this.selectedHero = null;
  }

  deleteHero(hero: Hero) {
    this.unselect();
    this.heroDispatchers.delete(hero);
  }

  enableAddMode() {
    this.addingHero = true;
    this.selectedHero = null;
  }

  filterHeroes() {
    this.heroDispatchers.getFiltered();
  }

  getHeroes() {
    this.heroDispatchers.getAll();
    this.unselect();
  }

  onSelect(hero: Hero) {
    this.addingHero = false;
    this.selectedHero = hero;
  }

  update(hero: Hero) {
    this.heroDispatchers.update(hero);
  }

  add(hero: Hero) {
    this.heroDispatchers.add(hero);
  }

  unselect() {
    this.addingHero = false;
    this.selectedHero = null;
  }
}