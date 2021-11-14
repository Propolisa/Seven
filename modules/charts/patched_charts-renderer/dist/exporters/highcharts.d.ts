/// <reference types="node" />
import { Options } from 'highcharts';
import { ChartOptions, InitOptions } from '../interfaces';
import { Page } from 'puppeteer';
export interface HighchartsRenderOptions extends ChartOptions {
    config: Options;
}
export interface HighchartsInitOptions extends InitOptions {
    highstock?: boolean;
}
export declare function init(page: Page, init: HighchartsInitOptions): Promise<void>;
export declare function render(page: Page, options: HighchartsRenderOptions, init: HighchartsInitOptions): Promise<Buffer>;
declare const _default: {
    render: typeof render;
    init: typeof init;
};
export default _default;
