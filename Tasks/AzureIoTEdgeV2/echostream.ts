import * as stream from 'stream';

export class EchoStream extends stream.Writable {
  public content: string = '';
  public _write(chunk: any, enc: any, next: () => void) {
    const s = chunk.toString();
    console.log(s);
    this.content += s;
    next();
  }
}
