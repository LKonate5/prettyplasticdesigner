import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ExportLead, LeadRequestContext, SampleProductSelection } from '../embed/email';
import type { MaterialId, ProductId } from '../core/types';
import { COUNTRIES } from '../data/countries';
import { MATERIALS } from '../data/palette';
import { PRODUCT_LIST } from '../data/products';
import { STR } from '../strings';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAMPLE_MATERIAL_MAX = 5;
const PROJECT_PHASES = [
  STR.phaseConcept,
  STR.phasePreliminaryDesign,
  STR.phaseDefinitiveDesign,
  STR.phaseTender,
  STR.phaseConstruction,
];

const stripRequestDetails = (lead: ExportLead): ExportLead => ({
  firstName: lead.firstName,
  lastName: lead.lastName,
  email: lead.email,
  company: lead.company,
  projectName: lead.projectName,
  projectPhase: lead.projectPhase,
});

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function hasValidSampleSelections(selections: readonly SampleProductSelection[]): boolean {
  const materialCount = countSampleMaterials(selections);
  return (
    selections.length > 0 &&
    materialCount > 0 &&
    materialCount <= SAMPLE_MATERIAL_MAX &&
    selections.every((selection) => selection.materialIds.length > 0)
  );
}

function countSampleMaterials(selections: readonly SampleProductSelection[]): number {
  return selections.reduce((sum, selection) => sum + selection.materialIds.length, 0);
}

function searchableCountryText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Lead-capture gate shown before export/email actions. Contact + project fields
 * are shared; quote/sample modes add only the fields that request needs.
 */
export function LeadCaptureModal({
  formatLabel,
  request,
  initialLead,
  onSubmit,
  onCancel,
}: {
  formatLabel: string;
  request: LeadRequestContext;
  initialLead: ExportLead | null;
  onSubmit: (lead: ExportLead, cacheLead: ExportLead) => void;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState(initialLead?.firstName ?? '');
  const [lastName, setLastName] = useState(initialLead?.lastName ?? '');
  const [email, setEmail] = useState(initialLead?.email ?? '');
  const [company, setCompany] = useState(initialLead?.company ?? '');
  const [projectName, setProjectName] = useState(initialLead?.projectName ?? '');
  const [projectPhase, setProjectPhase] = useState(initialLead?.projectPhase ?? '');
  const [quoteArea, setQuoteArea] = useState(
    request.quoteDefaults ? String(request.quoteDefaults.requestedAreaM2) : '',
  );
  const [quoteProducts, setQuoteProducts] = useState<ProductId[]>(
    request.quoteDefaults?.productIds ?? [],
  );
  const [streetName, setStreetName] = useState(request.sampleDefaults?.streetName ?? '');
  const [streetNumber, setStreetNumber] = useState(request.sampleDefaults?.streetNumber ?? '');
  const [streetAddition, setStreetAddition] = useState(request.sampleDefaults?.streetAddition ?? '');
  const [postalCode, setPostalCode] = useState(request.sampleDefaults?.postalCode ?? '');
  const [city, setCity] = useState(request.sampleDefaults?.city ?? '');
  const [country, setCountry] = useState(request.sampleDefaults?.country ?? '');
  const [sampleSelections, setSampleSelections] = useState<SampleProductSelection[]>(
    request.sampleDefaults?.selections ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lead: ExportLead = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      company: company.trim(),
      projectName: projectName.trim() || undefined,
      projectPhase: projectPhase || undefined,
    };
    if (!lead.firstName || !lead.lastName || !lead.email || !lead.company) {
      setError(STR.exportLeadRequired);
      return;
    }
    if (!EMAIL_RE.test(lead.email)) {
      setError(STR.exportLeadInvalidEmail);
      return;
    }

    if (request.mode === 'quote') {
      const requestedAreaM2 = Number(quoteArea);
      if (!Number.isFinite(requestedAreaM2) || requestedAreaM2 <= 0 || quoteProducts.length === 0) {
        setError(STR.quoteLeadRequired);
        return;
      }
      lead.quote = { requestedAreaM2, productIds: quoteProducts };
    }

    if (request.mode === 'sample') {
      const cleanStreetName = streetName.trim();
      const cleanStreetNumber = streetNumber.trim();
      const cleanStreetAddition = streetAddition.trim();
      const cleanPostalCode = postalCode.trim();
      const cleanCity = city.trim();
      const cleanCountry = country.trim();
      if (
        !cleanStreetName ||
        !cleanStreetNumber ||
        !cleanPostalCode ||
        !cleanCity ||
        !cleanCountry ||
        !hasValidSampleSelections(sampleSelections)
      ) {
        setError(STR.sampleLeadRequired);
        return;
      }
      lead.sample = {
        streetName: cleanStreetName,
        streetNumber: cleanStreetNumber,
        streetAddition: cleanStreetAddition || undefined,
        postalCode: cleanPostalCode,
        city: cleanCity,
        country: cleanCountry,
        selections: sampleSelections,
      };
    }

    onSubmit(lead, stripRequestDetails(lead));
  };

  const wide = request.mode !== 'generic';

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel}>
      <form
        className={`modal-card${wide ? ' modal-card-wide' : ''}`}
        noValidate
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>{STR.exportLeadTitle}</h3>
        <p className="note" style={{ marginBottom: 2 }}>
          <strong>{formatLabel}</strong>
        </p>
        <p className="note">{STR.exportLeadHint}</p>

        <div className="row">
          <div className="field">
            <label htmlFor="lead-first-name">{STR.firstName}</label>
            <input
              id="lead-first-name"
              ref={firstInputRef}
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="lead-last-name">{STR.lastName}</label>
            <input
              id="lead-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="lead-email">{STR.contactEmail}</label>
          <input
            id="lead-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="lead-company">{STR.company}</label>
          <input
            id="lead-company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        <h4>{STR.projectDetails}</h4>
        <div className="field">
          <label htmlFor="lead-project-name">{STR.projectName}</label>
          <input
            id="lead-project-name"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="lead-project-phase">{STR.projectPhase}</label>
          <select
            id="lead-project-phase"
            value={projectPhase}
            onChange={(e) => setProjectPhase(e.target.value)}
          >
            <option value="">{STR.projectPhasePlaceholder}</option>
            {PROJECT_PHASES.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
        </div>

        {request.mode === 'quote' && (
          <>
            <h4>{STR.quoteDetails}</h4>
            <div className="field">
              <label htmlFor="lead-quote-area">{STR.requestedAreaM2}</label>
              <input
                id="lead-quote-area"
                type="number"
                min={1}
                step={1}
                value={quoteArea}
                onChange={(e) => setQuoteArea(e.target.value)}
              />
            </div>
            <ProductChecks
              selected={quoteProducts}
              onToggle={(id) => setQuoteProducts((list) => toggle(list, id))}
            />
          </>
        )}

        {request.mode === 'sample' && (
          <>
            <h4>{STR.sampleDetails}</h4>
            <div className="row">
              <div className="field" style={{ flex: 2 }}>
                <label htmlFor="lead-street-name">{STR.streetName}</label>
                <input
                  id="lead-street-name"
                  type="text"
                  value={streetName}
                  onChange={(e) => setStreetName(e.target.value)}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="lead-street-number">{STR.streetNumber}</label>
                <input
                  id="lead-street-number"
                  type="text"
                  value={streetNumber}
                  onChange={(e) => setStreetNumber(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="lead-street-addition">{STR.streetAddition}</label>
              <input
                id="lead-street-addition"
                type="text"
                value={streetAddition}
                onChange={(e) => setStreetAddition(e.target.value)}
              />
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="lead-postal-code">{STR.postalCode}</label>
                <input
                  id="lead-postal-code"
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="lead-city">{STR.city}</label>
                <input
                  id="lead-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <CountryCombobox value={country} onChange={setCountry} />
            </div>
            <ProductChecks
              selected={sampleSelections.map((selection) => selection.productId)}
              onToggle={(id) =>
                setSampleSelections((list) =>
                  list.some((selection) => selection.productId === id)
                    ? list.filter((selection) => selection.productId !== id)
                    : [...list, { productId: id, materialIds: [] }],
                )
              }
              label={STR.productsRequested}
            />
            <SampleMaterialChecks
              selections={sampleSelections}
              onToggle={(productId, materialId) =>
                setSampleSelections((list) =>
                  toggleSampleMaterial(list, productId, materialId),
                )
              }
            />
          </>
        )}

        {error && <p className="warn">{error}</p>}

        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn" onClick={onCancel}>
            {STR.exportLeadCancel}
          </button>
          <button type="submit" className="btn primary">
            {STR.exportLeadSubmit}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function toggleSampleMaterial(
  selections: readonly SampleProductSelection[],
  productId: ProductId,
  materialId: MaterialId,
): SampleProductSelection[] {
  const total = countSampleMaterials(selections);
  return selections.map((selection) => {
    if (selection.productId !== productId) return selection;
    if (selection.materialIds.includes(materialId)) {
      return { ...selection, materialIds: selection.materialIds.filter((id) => id !== materialId) };
    }
    if (total >= SAMPLE_MATERIAL_MAX) return selection;
    return { ...selection, materialIds: [...selection.materialIds, materialId] };
  });
}

function CountryCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const query = searchableCountryText(value.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim());
  const matches = useMemo(
    () =>
      COUNTRIES.filter((country) => {
        if (!query) return true;
        return searchableCountryText(`${country.name} ${country.code}`).includes(query);
      }),
    [query],
  );

  return (
    <div className="country-combobox">
      <label htmlFor="lead-country">{STR.country}</label>
      <input
        id="lead-country"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="lead-country-options"
        autoComplete="off"
        placeholder={STR.countryPlaceholder}
        value={value}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => {
          setOpen(true);
          e.currentTarget.select();
        }}
      />
      {open && (
        <div id="lead-country-options" className="country-options" role="listbox">
          {matches.length > 0 ? (
            matches.map((country) => (
              <button
                key={country.code}
                type="button"
                className="country-option"
                role="option"
                aria-selected={country.label === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(country.label);
                  setOpen(false);
                }}
              >
                <span className="country-flag">{country.flag}</span>
                <span>{country.name}</span>
                <span className="country-code">{country.code}</span>
              </button>
            ))
          ) : (
            <div className="country-option empty">{STR.countryNoResults}</div>
          )}
        </div>
      )}
    </div>
  );
}

function ProductChecks({
  selected,
  onToggle,
  label = STR.productsRequested,
}: {
  selected: readonly ProductId[];
  onToggle: (id: ProductId) => void;
  label?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="choice-list">
        {PRODUCT_LIST.map((product) => (
          <label key={product.id} className="check">
            <input
              type="checkbox"
              checked={selected.includes(product.id)}
              onChange={() => onToggle(product.id)}
            />
            {product.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function SampleMaterialChecks({
  selections,
  onToggle,
}: {
  selections: readonly SampleProductSelection[];
  onToggle: (productId: ProductId, materialId: MaterialId) => void;
}) {
  if (selections.length === 0) return null;
  const totalSelected = countSampleMaterials(selections);
  const maxed = totalSelected >= SAMPLE_MATERIAL_MAX;
  return (
    <div className="field">
      <label>{STR.coloursAndShadesRequested}</label>
      <p className="note" style={{ marginBottom: 6 }}>
        {STR.sampleColoursTotalHint} ({totalSelected}/{SAMPLE_MATERIAL_MAX})
      </p>
      <div className="choice-list">
        {selections.map((selection) => {
          const selectedSet = new Set(selection.materialIds);
          return (
            <div key={selection.productId}>
              <p className="note" style={{ marginBottom: 6 }}>
                <strong>{PRODUCT_LIST.find((product) => product.id === selection.productId)?.name}</strong>
              </p>
              <div className="choice-grid">
                {MATERIALS.map((material) => {
                  const checked = selectedSet.has(material.id);
                  return (
                    <label key={material.id} className="check">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!checked && maxed}
                        onChange={() => onToggle(selection.productId, material.id)}
                      />
                      <span className="dot" style={{ background: material.hex }} />
                      {material.name}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
