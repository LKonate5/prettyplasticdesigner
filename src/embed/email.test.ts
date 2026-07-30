import { describe, expect, it } from 'vitest';
import { computeLayout } from '../core/layout';
import { computeOrder, computeSchedule } from '../core/schedule';
import { initialDesign } from '../core/state/reducer';
import { PRODUCTS } from '../data/products';
import {
  exportNotificationEmail,
  quoteEmail,
  sampleEmail,
  withLead,
  type ExportLead,
} from './email';

function fixtures() {
  const design = initialDesign('second-high', 123);
  const product = PRODUCTS[design.productId];
  const layout = computeLayout(product, design.rows, design.cols, design.options);
  const schedule = computeSchedule(product, layout, design.cells);
  const order = computeOrder(product, schedule, design.wastePct);
  return { design, product, schedule, order };
}

const lead: ExportLead = {
  firstName: 'Ari',
  lastName: 'Stone',
  email: 'ari@example.com',
  company: 'Facade Studio',
  projectName: 'Harbour House',
  projectPhase: 'Tender',
};

describe('lead email content', () => {
  it('prefixes outgoing bodies with required contact and optional project details', () => {
    expect(withLead(lead, 'Body')).toContain('From: Ari Stone');
    expect(withLead(lead, 'Body')).toContain('Project name: Harbour House');
    expect(withLead(lead, 'Body')).toContain('Project phase: Tender');
  });

  it('adds project details to export notifications', () => {
    const { design, product, schedule } = fixtures();
    const { body } = exportNotificationEmail(lead, 'PDF spec sheet', product, schedule, design);
    expect(body).toContain('Project name: Harbour House');
    expect(body).toContain('Project phase: Tender');
  });

  it('includes requested m2 and products in quote emails', () => {
    const { design, product, schedule, order } = fixtures();
    const { body } = quoteEmail(product, schedule, design, order, {
      requestedAreaM2: 42,
      productIds: ['first-one', 'basic-third'],
    });
    expect(body).toContain('Requested area: 42 m²');
    expect(body).toContain('Products: First One, Basic Third');
    expect(body).toContain('Design link: #d=');
  });

  it('includes address, products and colours in sample emails', () => {
    const { design, product, schedule } = fixtures();
    const { body } = sampleEmail(product, schedule, design, {
      streetName: 'Canal Street',
      streetNumber: '12',
      streetAddition: 'A',
      postalCode: '1011 AB',
      city: 'Amsterdam',
      country: 'Netherlands 🇳🇱',
      selections: [
        { productId: 'second-high', materialIds: ['green-medium', 'grey-dark'] },
        { productId: 'basic-third', materialIds: ['ochre-light'] },
      ],
    });
    expect(body).toContain('Canal Street 12 A');
    expect(body).toContain('1011 AB Amsterdam');
    expect(body).toContain('Netherlands 🇳🇱');
    expect(body).toContain('Second High: Green Medium, Grey Dark');
    expect(body).toContain('Basic Third: Ochre Light');
    expect(body).toContain('Design link: #d=');
  });
});
