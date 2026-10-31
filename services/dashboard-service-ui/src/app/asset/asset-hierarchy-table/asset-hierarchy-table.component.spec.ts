import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssetHierarchyTableComponent } from './asset-hierarchy-table.component';

describe('AssetHierarchyTableComponent', () => {
  let component: AssetHierarchyTableComponent;
  let fixture: ComponentFixture<AssetHierarchyTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AssetHierarchyTableComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssetHierarchyTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
