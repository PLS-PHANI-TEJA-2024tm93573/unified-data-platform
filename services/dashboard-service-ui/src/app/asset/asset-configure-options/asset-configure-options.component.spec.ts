import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssetConfigureOptionsComponent } from './asset-configure-options.component';

describe('AssetConfigureOptionsComponent', () => {
  let component: AssetConfigureOptionsComponent;
  let fixture: ComponentFixture<AssetConfigureOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AssetConfigureOptionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssetConfigureOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
