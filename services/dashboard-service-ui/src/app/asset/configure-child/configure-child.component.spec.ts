import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigureChildComponent } from './configure-child.component';

describe('ConfigureChildComponent', () => {
  let component: ConfigureChildComponent;
  let fixture: ComponentFixture<ConfigureChildComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ConfigureChildComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfigureChildComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
