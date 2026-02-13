import { TestBed } from '@angular/core/testing';

import { Map } from './map';

describe('Map', () => {
  let service: Map;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Map);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
