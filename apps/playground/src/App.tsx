import { useEffect, useMemo, useState } from "react";
import { decimateTimeSeries } from "@catmap/data";
import {
  BoreholeLog,
  CrossSectionView,
  InclinometerProfile,
  MultiInstrumentChart,
  PiezometerChart,
  RainfallResponseChart,
  SensorHealthChart,
  SettlementChart,
  SpectralWaterfallChart
} from "@catmap/react";
import "uplot/dist/uPlot.min.css";
import {
  boreholeIntervals,
  comparisonSeries,
  crossSectionInstruments,
  crossSectionSeries,
  createSpectralPerformanceData,
  inclinometerCampaigns,
  largeTimeSeries,
  piezometerInstrument,
  piezometerReadings,
  piezometerThresholds,
  rainfall,
  sensorHealth,
  settlementInstrument,
  settlementReadings,
  settlementThresholds,
  spectralSpectra,
  spectralX
} from "./data";
import "./style.css";

export function App() {
  const [decimated, setDecimated] = useState(largeTimeSeries.slice(0, 600));
  const [spectralMode, setSpectralMode] = useState<"demo" | "performance">("demo");
  const spectralPerformance = useMemo(
    () => (spectralMode === "performance" ? createSpectralPerformanceData() : null),
    [spectralMode]
  );
  const activeSpectralX = spectralPerformance?.x ?? spectralX;
  const activeSpectralSpectra = spectralPerformance?.spectra ?? spectralSpectra;
  const activeSpectralVertexCount =
    spectralPerformance?.vertexCount ?? spectralSpectra.reduce((sum, spectrum) => sum + spectrum.values.length, 0);

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

      <section className="case spectral-case">
        <div className="case-copy">
          <h2>Spectral waterfall</h2>
          <p>
            {activeSpectralSpectra.length.toLocaleString()} spectra, {activeSpectralVertexCount.toLocaleString()} vertices.
          </p>
          <div className="spectral-toolbar" role="group" aria-label="Spectral dataset">
            <button
              type="button"
              className={spectralMode === "demo" ? "active" : ""}
              onClick={() => setSpectralMode("demo")}
            >
              Demo
            </button>
            <button
              type="button"
              className={spectralMode === "performance" ? "active" : ""}
              onClick={() => setSpectralMode("performance")}
            >
              Performance
            </button>
          </div>
        </div>
        <SpectralWaterfallChart
          key={spectralMode}
          title="Interactive waterfall spectral chart"
          x={activeSpectralX}
          spectra={activeSpectralSpectra}
          height={560}
          renderer="auto"
          initialSelection={{ spectrumIndex: 0 }}
          initialSliceIndex={spectralMode === "performance" ? 5_400 : 214}
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
