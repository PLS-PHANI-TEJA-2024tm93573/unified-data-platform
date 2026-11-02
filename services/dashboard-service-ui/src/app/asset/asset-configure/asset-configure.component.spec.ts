import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssetConfigureComponent } from './asset-configure.component';

describe('AssetConfigureComponent', () => {
  let component: AssetConfigureComponent;
  let fixture: ComponentFixture<AssetConfigureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AssetConfigureComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssetConfigureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
