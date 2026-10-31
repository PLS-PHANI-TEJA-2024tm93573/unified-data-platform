import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssetRootComponent } from './asset-root.component';

describe('AssetRootComponent', () => {
  let component: AssetRootComponent;
  let fixture: ComponentFixture<AssetRootComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AssetRootComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssetRootComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
