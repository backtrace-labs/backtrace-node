import FormData from 'form-data';
import * as path from 'path';
import axios from 'axios';
import { BacktraceReport } from './model/backtraceReport';
import * as fs from 'fs';

export class BacktraceApi {
  constructor(private backtraceUri: string) {}

  public async send(report: BacktraceReport): Promise<void> {
    const formData = await this.getFormData(report);
    try {
      const result = await axios.post(this.backtraceUri, formData, {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
        },
      });
      if (result.status !== 200) {
        console.error(
          `Invalid attempt to submit error to Backtrace. Result: ${result}`
        );
      }
    } catch (err) {
      console.error(
        `Invalid attempt to submit error to Backtrace. Error Message: ${err}`
      );
    }
  }

  private async getFormData(report: BacktraceReport): Promise<FormData> {
    const formData = new FormData();
    const json: string = JSON.stringify(await report.toJson());
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
