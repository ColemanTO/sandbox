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

  describe('duration defaults', () => {
    const undo = { label: 'Undo', handler: () => {} };

    it('is 5 seconds for a toast without an action', () => {
      service.info('Plain');
      expect(service.toasts()[0].duration).toBe(5000);
    });

    it('is 0 (stays until dismissed) for a toast with an action', () => {
      service.info('Deleted', { action: undo });
      expect(service.toasts()[0].duration).toBe(0);
    });

    it('lets an explicit duration override both defaults', () => {
      service.info('Plain', { duration: 0 });
      service.info('Deleted', { action: undo, duration: 8000 });
      expect(service.toasts().map((t) => t.duration)).toEqual([0, 8000]);
    });

    it('applies to every type, including errors with an action', () => {
      service.error('Failed', { action: { label: 'Retry', handler: () => {} } });
      expect(service.toasts()[0].duration).toBe(0);
    });
  });
});
