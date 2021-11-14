/// <reference types="chart.js" />
/// <reference types="node" />
import { ChartOptions, InitOptions } from '../interfaces';
import { Page } from 'puppeteer';
export interface ChartjsRenderOptions extends ChartOptions {
    config: Chart.ChartConfiguration;
    chartWidth?: number;
    chartHeight?: number;
}
declare function init(page: Page): Promise<void>;
declare function render(page: Page, options: ChartjsRenderOptions, init: InitOptions): Promise<Buffer>;
declare const _default: {
    render: typeof render;
    init: typeof init;
};
export default _default;
