import { Component, OnInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { Subject } from 'rxjs';
import { ScoreboardRendererComponent } from './scoreboard-renderer.component';

export interface ScreenPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export enum ScoreboardState {
  NOT_READY,
  READY,
  PLAYING
}

@Component({
  selector: 'app-scoreboard',
  templateUrl: './scoreboard.component.html',
  styleUrls: ['./scoreboard.component.scss']
})
export class ScoreboardComponent implements OnInit {
  @ViewChild('rendererElement', { static: true }) rendererElement!: ScoreboardRendererComponent;
  screenPosition$?: Subject<ScreenPosition>;
  scoreboardReady$?: Subject<ScoreboardState>;
  
  chromeVersion = 0;

  @HostListener('window:message', ['$event'])
  onMessage(ev: MessageEvent) {
    if (ev.data === 'start') {
      this.onStart();
    }
  }

  @HostListener('window:click', ['$event'])
  onClick(ev: MessageEvent) {
    this.onStart();
  }

  @HostListener('window:beforeunload')
  onDestroy() {
    const screenPosition$ = (window as any).screenPosition$;
    if (screenPosition$) {
      if ((window as any).fullscreen) {
        screenPosition$.next(undefined);
      } else {
        screenPosition$.next({ x: window.screenX, y: window.screenY, width: window.outerWidth, height: window.outerHeight });
      }
    }
  }

  ngOnInit(): void {
    this.chromeVersion = Number((navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./) ?? [])[2] ?? '0');

    this.scoreboardReady$ = (window as any).scoreboardReady$;
    this.scoreboardReady$?.next(ScoreboardState.READY);
  }

  onStart(): void {
    document.documentElement
        .requestFullscreen()
        .then(v => {
          window.focus();
          this.scoreboardReady$?.next(ScoreboardState.PLAYING);
          this.rendererElement.triggerAnimation();
        });
  }
}
