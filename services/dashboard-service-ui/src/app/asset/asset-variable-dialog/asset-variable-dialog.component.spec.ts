import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssetVariableDialogComponent } from './asset-variable-dialog.component';

describe('AssetVariableDialogComponent', () => {
  let component: AssetVariableDialogComponent;
  let fixture: ComponentFixture<AssetVariableDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AssetVariableDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssetVariableDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
