import { useEffect, useState } from "react";
import { decimateTimeSeries } from "@catmap/data";
import {
  BoreholeLog,
  CrossSectionView,
  InclinometerProfile,
  InstrumentMap,
  MultiInstrumentChart,
  PiezometerChart,
  RainfallResponseChart,
  SensorHealthChart,
  SettlementChart
} from "@catmap/react";
import "maplibre-gl/dist/maplibre-gl.css";
import "uplot/dist/uPlot.min.css";
import {
  boreholeIntervals,
  comparisonSeries,
  contours,
  crossSectionInstruments,
  crossSectionSeries,
  heatmapPoints,
  inclinometerCampaigns,
  instruments,
  largeTimeSeries,
  piezometerInstrument,
  piezometerReadings,
  piezometerThresholds,
  rainfall,
  sensorHealth,
  settlementInstrument,
  settlementReadings,
  settlementThresholds
} from "./data";
import "./style.css";

export function App() {
  const [decimated, setDecimated] = useState(largeTimeSeries.slice(0, 600));

  useEffect(() => {
    void decimateTimeSeries(largeTimeSeries, { maxPoints: 600, useWorker: true }).then(setDecimated);
  }, []);

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
          <p>Three nearby piezometers compared on the same elevation scale, with missing markers.</p>
        </div>
        <MultiInstrumentChart
          title="Piezometer comparison"
          yLabel="Water level"
          series={comparisonSeries}
          thresholds={piezometerThresholds}
          showThresholds
        />
      </section>

      <section className="case">
        <div className="case-copy">
          <h2>Inclinometer profile</h2>
          <p>Three displacement campaigns compared by depth.</p>
        </div>
        <InclinometerProfile campaigns={inclinometerCampaigns} axis="displacementX" showMissingData />
      </section>

      <section className="case">
        <div className="case-copy">
          <h2>Sensor health</h2>
          <p>Uptime, warning and critical percentages by instrument.</p>
        </div>
        <SensorHealthChart readings={sensorHealth} />
      </section>

      <section className="case">
        <div className="case-copy">
          <h2>Worker decimation demo</h2>
          <p>{largeTimeSeries.length.toLocaleString()} readings reduced to {decimated.length.toLocaleString()} points.</p>
        </div>
        <MultiInstrumentChart
          title="Large time series decimation"
          yLabel="Water level"
          series={[
            {
              id: "decimated",
              label: "Decimated series",
              unit: "m",
              readings: decimated
            }
          ]}
        />
      </section>

      <section className="case map-case">
        <div className="case-copy">
          <h2>Instrument map with heatmap and contours</h2>
          <p>MapLibre heatmap points with precalculated contour isolines.</p>
        </div>
        <InstrumentMap
          center={[-70.31, -27.44]}
          zoom={14}
          instruments={instruments}
          heatmap={{ points: heatmapPoints, radius: 34, opacity: 0.72 }}
          contours={{ lines: contours, width: 2 }}
        />
      </section>

      <section className="case">
        <div className="case-copy">
          <h2>Cross-section view</h2>
          <p>Ground surface, piezometric level and instrument depths along section A.</p>
        </div>
        <CrossSectionView
          title="Section A"
          series={crossSectionSeries}
          instruments={crossSectionInstruments}
          height={340}
        />
      </section>

      <section className="case borehole-case">
        <div className="case-copy">
          <h2>Borehole log</h2>
          <p>Depth intervals with water level marker.</p>
        </div>
        <BoreholeLog boreholeId="BH-01" intervals={boreholeIntervals} waterLevel={10.5} width={520} height={420} />
      </section>
    </main>
  );
}
