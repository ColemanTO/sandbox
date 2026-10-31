import { ComponentFixture, TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { A11yToastContainer } from './toast-container';
import { A11yToastService } from './toast.service';

/**
 * Automated accessibility checks. axe catches roughly a third of WCAG issues
 * (names, roles, ARIA validity, labels); it does not replace testing with a
 * screen reader. Color contrast is skipped because jsdom has no layout engine.
 */
async function violationsIn(element: HTMLElement) {
  const results = await axe.run(element, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target).join(', ')})`);
}

describe('A11yToastContainer accessibility (axe)', () => {
  let fixture: ComponentFixture<A11yToastContainer>;
  let service: A11yToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [A11yToastContainer] }).compileComponents();
    service = TestBed.inject(A11yToastService);
    fixture = TestBed.createComponent(A11yToastContainer);
    fixture.detectChanges();
  });

  it('has no violations when empty', async () => {
    expect(await violationsIn(fixture.nativeElement)).toEqual([]);
  });

  it('has no violations with every toast type showing', async () => {
    service.info('Info message', { duration: 0 });
    service.success('Success message', { duration: 0 });
    service.warning('Warning message', { duration: 0 });
    service.error('Error message', { duration: 0 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('a11y-toast-item')).toHaveLength(4);
    expect(await violationsIn(fixture.nativeElement)).toEqual([]);
  });

  it('has no violations with an action button', async () => {
    service.info('Item deleted', { duration: 0, action: { label: 'Undo', handler: () => {} } });
    fixture.detectChanges();
    expect(await violationsIn(fixture.nativeElement)).toEqual([]);
  });
});
