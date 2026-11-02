import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddVariableDialogComponent } from './add-variable-dialog.component';

describe('AddVariableDialogComponent', () => {
  let component: AddVariableDialogComponent;
  let fixture: ComponentFixture<AddVariableDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddVariableDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddVariableDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
