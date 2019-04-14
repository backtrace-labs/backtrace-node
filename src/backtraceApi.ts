import FormData from 'form-data';
import * as path from 'path';
import axios from 'axios';
import { BacktraceReport } from './model/backtraceReport';
import * as fs from 'fs';
import { BacktraceResult } from './model/backtraceResult';
import { EventEmitter } from 'events';
import { BacktraceData } from './model/backtraceData';

export class BacktraceApi extends EventEmitter {
  constructor(private backtraceUri: string, private timeout: number) {
    super();
  }

  public async send(report: BacktraceReport): Promise<BacktraceResult> {
    const data = await report.toJson();
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
        const err = new Error(
          `Invalid attempt to submit error to Backtrace. Result: ${result}`
        );
        return BacktraceResult.OnError(report, err);
      }
      return BacktraceResult.Ok(report, result.data);
    } catch (err) {
      return BacktraceResult.OnError(report, err);
    }
  }

  private async getFormData(
    report: BacktraceReport,
    data: BacktraceData
  ): Promise<FormData> {
    const formData = new FormData();
    const json: string = JSON.stringify(data);
    formData.append('upload_file', json, 'upload_file.json');

    report.getAttachments().forEach(filePath => {
      const result = fs.existsSync(filePath);
      if (!result) {
        return;
      }
      const name = path.basename(filePath);
      formData.append(
        `attachment_${name}`,
        fs.createReadStream(filePath),
        name
      );
    });

    return formData;
  }
}
