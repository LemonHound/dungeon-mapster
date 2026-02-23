import {ComponentFixture, TestBed} from '@angular/core/testing';

import {DemoMapEditor} from './demo-map-editor';

describe('DemoMapEditor', () => {
  let component: DemoMapEditor;
  let fixture: ComponentFixture<DemoMapEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DemoMapEditor]
    })
      .compileComponents();

    fixture = TestBed.createComponent(DemoMapEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
