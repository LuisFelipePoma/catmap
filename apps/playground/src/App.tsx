import {
  InstrumentMap,
  MultiInstrumentChart,
  PiezometerChart,
  RainfallResponseChart,
  SettlementChart
} from "@catmap/react";
import "maplibre-gl/dist/maplibre-gl.css";
import "uplot/dist/uPlot.min.css";
import {
  comparisonSeries,
  instruments,
  piezometerInstrument,
  piezometerReadings,
  piezometerThresholds,
  rainfall,
  settlementInstrument,
  settlementReadings,
  settlementThresholds
} from "./data";
import "./style.css";

export function App() {
  return (
    <main>
      <header>
        <h1>catmap</h1>
        <p>Operational geotechnical monitoring charts</p>
      </header>

      <section className="case">
        <div className="case-copy">
          <h2>Piezometer trigger levels</h2>
          <p>Water level with warning/action thresholds and a missing-data gap.</p>
        </div>
        <PiezometerChart
          instrument={piezometerInstrument}
          readings={piezometerReadings}
          thresholds={piezometerThresholds}
          yAxis="waterLevel"
          showThresholds
          showMissingData
        />
      </section>

      <section className="case">
        <div className="case-copy">
          <h2>Rainfall response</h2>
          <p>Daily rainfall bars against delayed piezometer response.</p>
        </div>
        <RainfallResponseChart
          rainfall={rainfall}
          readings={piezometerReadings}
          thresholds={piezometerThresholds}
          responseAxis="waterLevel"
          showThresholds
        />
      </section>

      <section className="case">
        <div className="case-copy">
          <h2>Settlement monitoring</h2>
          <p>Cumulative settlement trend with review and action levels.</p>
        </div>
        <SettlementChart
          instrument={settlementInstrument}
          readings={settlementReadings}
          thresholds={settlementThresholds}
          showThresholds
          showMissingData
        />
      </section>

      <section className="case">
        <div className="case-copy">
          <h2>Multi-instrument comparison</h2>
          <p>Three nearby piezometers compared on the same elevation scale.</p>
        </div>
        <MultiInstrumentChart
          title="Piezometer comparison"
          yLabel="Water level"
          series={comparisonSeries}
          thresholds={piezometerThresholds}
          showThresholds
        />
      </section>

      <section className="case map-case">
        <div className="case-copy">
          <h2>Instrument map</h2>
          <p>Secondary context only; chart work remains the focus.</p>
        </div>
        <InstrumentMap center={[-70.31, -27.44]} zoom={14} instruments={instruments} />
      </section>
    </main>
  );
}
