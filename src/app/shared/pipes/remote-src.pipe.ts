import { Pipe, PipeTransform } from '@angular/core';
import { Observable, of } from 'rxjs';
import { RemoteImageService } from '../services/remote-image.service';

@Pipe({ name: 'remoteSrc' })
export class RemoteSrcPipe implements PipeTransform {
  constructor(private remoteImage: RemoteImageService) {}

  transform(url: string | null | undefined): Observable<string> {
    if (!url) {
      return of('');
    }
    return this.remoteImage.resolve(url);
  }
}
