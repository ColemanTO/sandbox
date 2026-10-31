import { TestBed } from '@angular/core/testing';
import { A11yToastService } from './toast.service';

describe('A11yToastService', () => {
  let service: A11yToastService;

  beforeEach(() => {
    service = TestBed.inject(A11yToastService);
  });

  it('adds a toast with defaults', () => {
    service.show('Saved');
    expect(service.toasts()).toEqual([
      expect.objectContaining({ message: 'Saved', type: 'info', duration: 5000, politeness: 'polite' }),
    ]);
  });

  it('announces errors assertively and everything else politely', () => {
    service.error('Failed');
    service.success('Done');
    expect(service.assertive().map((t) => t.message)).toEqual(['Failed']);
    expect(service.polite().map((t) => t.message)).toEqual(['Done']);
  });

  it('lets politeness be overridden', () => {
    service.info('Heads up', { politeness: 'assertive' });
    expect(service.assertive()).toHaveLength(1);
  });

  it('dismisses by id and dismisses all', () => {
    const a = service.info('A');
    service.info('B');
    service.dismiss(a);
    expect(service.toasts().map((t) => t.message)).toEqual(['B']);
    service.dismissAll();
    expect(service.toasts()).toEqual([]);
  });
});
