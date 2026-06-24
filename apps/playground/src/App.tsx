import { InstrumentMap, PiezometerChart } from "@catmap/react";
import "maplibre-gl/dist/maplibre-gl.css";
import "uplot/dist/uPlot.min.css";
import { instrument, instruments, readings, thresholds } from "./data";
import "./style.css";

export function App() {
  return (
    <main>
      <header>
        <h1>catmap</h1>
        <p>Geotechnical visualization playground</p>
      </header>

      <section>
        <h2>PiezometerChart</h2>
        <PiezometerChart
          instrument={instrument}
          readings={readings}
          thresholds={thresholds}
          yAxis="waterLevel"
          showThresholds
        />
      </section>

      <section>
        <h2>InstrumentMap</h2>
        <InstrumentMap
          center={[-70.31, -27.44]}
          zoom={14}
          instruments={instruments}
        />
      </section>
    </main>
  );
}
