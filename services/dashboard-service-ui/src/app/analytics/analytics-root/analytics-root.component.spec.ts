import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnalyticsRootComponent } from './analytics-root.component';

describe('AnalyticsRootComponent', () => {
  let component: AnalyticsRootComponent;
  let fixture: ComponentFixture<AnalyticsRootComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AnalyticsRootComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnalyticsRootComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
