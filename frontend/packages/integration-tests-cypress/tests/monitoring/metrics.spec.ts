const measurementName = 'chart-rendering';
const startMarker = `${measurementName}:start`;
const endMarker = `${measurementName}:end`;

const query = 'topk(500, cluster_quantile:apiserver_request_duration_seconds:histogram_quantile)';

const measureChartRendering = (win: Cypress.AUTWindow) =>
  cy.wrap<Promise<PerformanceMeasure>, PerformanceMeasure>(
    new Promise((resolve) => {
      const { performance } = win;

      cy.byTestID('query-input').type(query, { parseSpecialCharSequences: false, delay: 0 });
      cy.byTestID('run-queries-button').click();
      performance.mark(startMarker);

      cy.byTestID('graph-container')
        .find('svg')
        .then(() => {
          performance.mark(endMarker);
          const measure = (performance.measure(
            measurementName,
            startMarker,
            endMarker,
          ) as unknown) as PerformanceMeasure;
          resolve(measure);
        });
    }),
  );

const numberOfSamples = 5;
const threshold = 4;

describe('Monitoring: Metrics', () => {
  describe('Measure average rendering time for a graph with large data', () => {
    const measuredSamples = [];

    before(() => {
      cy.fixture('prometheus-query-response.json').as('prometheus-query-response');
      cy.fixture('prometheus-query-range-response.json').as('prometheus-query-range-response');
      cy.fixture('prometheus-labels-response.json').as('prometheus-labels-response');
      cy.fixture('prometheus-rules-response.json').as('prometheus-rules-response');
    });

    beforeEach(() => {
      cy.intercept('GET', '/api/prometheus/api/v1/query*', {
        fixture: 'prometheus-query-response',
      }).as('prometheus-query');
      cy.intercept('GET', '/api/prometheus/api/v1/query_range*', {
        fixture: 'prometheus-query-range-response',
      }).as('prometheus-query-range');
      cy.intercept('GET', '/api/prometheus/api/v1/label/__name__/values*', {
        fixture: 'prometheus-labels-response',
      }).as('prometheus-labels-query');
      cy.intercept('GET', 'api/prometheus/api/v1/rules', {
        fixture: 'prometheus-rules-response',
      }).as('prometheus-rules-query');
    });

    Cypress._.times(numberOfSamples, (num) => {
      it(`chart rendering measurement ${num + 1}`, () => {
        cy.visit('/monitoring/query-browser');

        cy.window()
          .then((win) => measureChartRendering(win))
          .then((measure) => {
            cy.log(`Measured sample: ${measure.duration}`);
            measuredSamples.push(measure);
          });
      });
    });

    it(`the average rendering time for ${numberOfSamples} samples should be less than ${threshold} seconds`, () => {
      const renderingTimeAvg =
        measuredSamples.reduce((acc, value) => acc + value.duration, 0) / measuredSamples.length;

      expect(renderingTimeAvg).toBeLessThan(threshold * 1000);
    });
  });
});
