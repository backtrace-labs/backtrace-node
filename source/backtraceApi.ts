import axios from 'axios';
import { EventEmitter } from 'events';
import FormData from 'form-data';
import * as fs from 'fs';
import stringify from 'json-stringify-safe';
import * as path from 'path';
import { IBacktraceData } from './model/backtraceData';
import { BacktraceReport } from './model/backtraceReport';
import { BacktraceResult } from './model/backtraceResult';

export class BacktraceApi extends EventEmitter {
  private _sourceCodeSupport = true;
  public setSourceCodeSupport(enable: boolean) {
    this._sourceCodeSupport = enable === true;
  }
  constructor(private backtraceUri: string, private timeout: number) {
    super();
  }

  public async send(report: BacktraceReport): Promise<BacktraceResult> {
    const data = await report.toJson(this._sourceCodeSupport);
    this.emit('before-data-send', report, data);
    const formData = await this.getFormData(report, data);
    try {
      const result = await axios.post(this.backtraceUri, formData, {
        timeout: this.timeout,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
        },
      });
      if (result.status !== 200) {
        const err = new Error(`Invalid attempt to submit error to Backtrace. Result: ${result}`);
        return BacktraceResult.OnError(report, err);
      }
      return BacktraceResult.Ok(report, result.data);
    } catch (err) {
      return BacktraceResult.OnError(report, err);
    }
  }

  private async getFormData(report: BacktraceReport, data: IBacktraceData): Promise<FormData> {
    const formData = new FormData();
    const json: string = stringify(data);
    formData.append('upload_file', json, 'upload_file.json');
    const attachments = report.getAttachments();
    if (attachments instanceof Array) {
      attachments.forEach((filePath) => {
        const result = fs.existsSync(filePath);
        if (!result) {
          return;
        }
        const name = path.basename(filePath);
        formData.append(`attachment_${name}`, fs.createReadStream(filePath), name);
      });
    }
    return formData;
  }
}
