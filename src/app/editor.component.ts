import { Component, HostListener, OnInit, NgZone } from '@angular/core';
import { Observable, of, Subject, take, takeUntil } from 'rxjs';
import { RenderData } from './data-model';
import { ScoreboardState, ScreenPosition } from './scoreboard.component';

export interface Team {
  name: string;
  scores: number[];
  totalScore: number;
}

export interface Category {
  name: string;
  highScore: number;
  lowScore: number;
}

export interface Board {
  teams: Team[];
  categories: Category[];
}

interface DialogAttributes {
  title: string;
  message: string;
  okLabel: string;
}


@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss']
})
export class EditorComponent implements OnInit {
  title = 'pub-quiz-scoreboard';
  screenPositionTitle = 'pub-quiz-scoreboard-position';

  introPlaying = true;

  board: Board = {
    teams: [],
    categories: [],
  };

  dialogAttributes?: DialogAttributes;
  dialogResponse$ = new Subject<boolean>();

  scoreWindow: Window | null = null;

  lastScreenPosition?: ScreenPosition;

  allowLaunchAnimation = false;

  destroySubscription$ = new Subject<void>();

  chromeVersion = 0;

  askForWindowManagement = false;

  constructor(private readonly zone: NgZone) {}

  @HostListener('window:beforeunload')
  onDestroyScoreboardWindow() {
    if (this.scoreWindow && !this.scoreWindow.closed) {
      this.scoreWindow.close();
    }
  }

  ngOnInit(): void {
    this.chromeVersion = Number((navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./) ?? [])[2] ?? '0');

    const popupPositition = localStorage.getItem(this.screenPositionTitle);
    if (popupPositition) {
      this.lastScreenPosition = JSON.parse(popupPositition);
    }
    const board = localStorage.getItem(this.title);
    if (!board) {
      this.resetBoard();
    } else {
      this.board = JSON.parse(board);
    }
  }

  onLaunch(): void {
    navigator.permissions.query({ name: 'window-placement' } as any)
    .then(status => {
      if (status.state === 'granted') {
        ((window as any).getScreenDetails() as Promise<any>).then(screenDetails => {
          const targetScreen = (screenDetails.screens as any[]).find(screen => screen != screenDetails.currentScreen) as any ?? screenDetails.currentScreen;
          this.lastScreenPosition = {
            x: targetScreen.left + targetScreen.availWidth / 8,
            y: targetScreen.top + targetScreen.availHeight / 8,
            width: targetScreen.availWidth / 3,
            height: targetScreen.availHeight / 3 };
          this.askForWindowManagement = false;
          this.onLaunchWindow();
        });
      } else {
        this.askForWindowManagement = true;
        ((window as any).getScreenDetails() as Promise<any>).then(_ => {
          this.onLaunch();
        });
      }
    });
  }

  onLaunchWindow(): void {
    const pos = this.lastScreenPosition ? this.lastScreenPosition : {x: 0, y: 0, width: 100, height: 100 };
    const params = `scrollbars=no,resizable=no,status=no,location=no,toolbar=no,menubar=no,width=${pos.width},height=${pos.height},left=${pos.x},top=${pos.y}`;
    
    this.allowLaunchAnimation = false;
    this.scoreWindow = open(location.href, 'Scoreboard', params);
    const scoreboardReady$ = new Subject<ScoreboardState>();
    (this.scoreWindow as any).scoreboardReady$ = scoreboardReady$;

    scoreboardReady$.pipe(takeUntil(this.destroySubscription$))
      .subscribe(state => {
        this.zone.run(() => {
          if (this.scoreWindow && !this.scoreWindow.closed && state === ScoreboardState.READY) {
            this.zone.run(() => {
              this.allowLaunchAnimation = true;
            });
          }
        });
      });
    const screenPosition$ = new Subject<ScreenPosition>();
    (this.scoreWindow as any).screenPosition$ = screenPosition$;
    screenPosition$.pipe(takeUntil(this.destroySubscription$))
      .subscribe(pos => {
        if (pos) {
          this.lastScreenPosition = pos;
          localStorage.setItem(this.screenPositionTitle, JSON.stringify(pos));  
        }
        this.zone.run(() => this.onClosePopup());
      });
  }

  onLaunchAnimation(fireworks?: boolean): void {
    const invalidScore = !!this.board.teams.find(team => !!team.scores.find(score => score > 24));
    if (invalidScore) {
      this.openDialog('Error', 'One score is greater than 24.', 'Ok')
      .subscribe(_ => undefined);
      return;
    }

    // Compute trends
    let trends;
    let placements;
    if (this.board.categories.length > 1) {
      const totalScores = this.board.teams.map(team => team.totalScore);
      const rankedTotalScores = [...totalScores].sort((a,b) => b - a);
      const currentRanks = totalScores.map(score => rankedTotalScores.findIndex(entry => entry === score));
      const previousTotalScores = this.board.teams.map(team => team.totalScore - team.scores[team.scores.length - 1]);
      const previousRankedTotalScores = [...previousTotalScores].sort((a,b) => b - a);
      const previousRanks = previousTotalScores.map(score => previousRankedTotalScores.findIndex(entry => entry === score));
      trends = currentRanks.map((rank, index) => rank - previousRanks[index]);
      placements = currentRanks.map(rank => rank + 1).map(rank => rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`);
    }

    const scoresPerCategory: number[][] = [];
    for (let c = 0; c < this.board.categories.length; c += 1) {
      for (let t = 0; t < this.board.teams.length; t += 1) {
        scoresPerCategory.push()
      }
    }
    const perfectScoreTeams = this.board.teams.map(team => team.scores[team.scores.length - 1] === 24 ? team.name : '').filter(team => !!team);
    const scoreboardData: RenderData = JSON.parse(JSON.stringify({
      fireworks,
      perfectScoreTeams,
      trends,
      placements,
      scoreOnFire: this.board.teams.map(team => team.scores[team.scores.length - 1]).reduce((a,b) => Math.max(a, b), 0),
      duration: 6000 + this.board.categories.length * 1000 + this.board.teams.length * 500 + (fireworks ? 2000 : 0) - (this.board.categories.length < 2 ? 2000 : 0),
      teams: this.board.teams.map(team => team.name),
      categories: this.board.categories.map(category => category.name),
      scores: this.board.categories.map((_, categoryIndex) => this.board.teams.map(team => team.scores[categoryIndex])),
    }));

    (this.scoreWindow as any).scoreboardData = scoreboardData;

    const message: any = { targetOrigin: location.href, delegate: 'fullscreen' };
    this.scoreWindow!.postMessage('start', message);
    this.scoreWindow!.focus();
  }

  onClosePopup(): void {
    if (this.scoreWindow && !this.scoreWindow.closed) {
      this.scoreWindow.close();
    }
    this.destroySubscription$.next();
    this.scoreWindow = null;
    this.allowLaunchAnimation = false;
  }

  onRunScoreboard(): void {
    const message: any = { targetOrigin: location.href, delegate: 'fullscreen' };
    this.scoreWindow!.postMessage('start', message);
  }

  onRunFireworks(): void {
    this.onLaunchAnimation(true);
  }

  onAddTeam(): void {
    const team: Team = { name: `Team ${this.board.teams.length + 1}`, scores: this.board.categories.map(_ => 0), totalScore: 0 };
    this.board.teams.push(team);
    this.saveState();
  }

  onAddCategory(): void {
    this.board.teams.forEach(team => {
      team.scores.push(0);
    });
    this.board.categories.push({ name: `Category ${this.board.categories.length + 1}`, highScore: 0, lowScore: 0 });
    this.saveState();
    setTimeout(() => {
      const element = document.getElementById(`categoryId${this.board.categories.length - 1}`);
      if (element) {
        element.focus();
      }
    }, 50);
  }

  onDeleteTeam(index: number): void {
    this.openDialog('Delete Team', `Are you sure you want to delete team '${this.board.teams[index].name}'?`, 'Delete')
      .pipe(take(1))
      .subscribe(response => {
        if (response) {
          this.board.teams.splice(index, 1);
          this.updateScores();
          this.saveState();
        }
      });
  }

  onDeleteCategory(index: number): void {
    this.openDialog('Delete Category', `Are you sure you want to delete category '${this.board.categories[index].name}'?`, 'Delete')
      .pipe(take(1))
      .subscribe(response => {
        if (response) {
          this.board.teams.forEach(team => {
            team.scores.splice(index, 1);
          });
          this.board.categories.splice(index, 1);
          this.updateScores();
          this.saveState();
        }
      });
  }

  onTeamNameChanged(event: Event, team: Team): void {
    team.name = (event.target as HTMLInputElement).value ?? '';
    this.saveState();
  }

  onCategoryNameChanged(event: Event, category: Category): void {
    category.name = (event.target as HTMLInputElement).value ?? '';
    this.saveState();
  }

  onScoreChanged(event: Event, team: Team, index: number): void {
    team.scores[index] = Number((event.target as HTMLInputElement).value) ?? 0;
    this.updateScores();
    this.saveState();
  }

  onResetBoard(): void {
    this.openDialog('Clear All', `Are you sure you want to clear all data?`, 'Clear')
      .pipe(take(1))
      .subscribe(response => {
        if (response) {
          this.resetBoard();
        }
      });
  }

  trackByName(index: number, item: any): number {
    return index;
  }

  closeDialog(response: boolean): void {
    this.dialogAttributes = undefined;
    this.dialogResponse$?.next(response);
  }

  private openDialog(title: string, message: string, okLabel: string): Observable<boolean> {
    if (this.dialogAttributes) {
      return of(false);
    }

    this.dialogAttributes = { title, message, okLabel };
    return this.dialogResponse$.asObservable();
  }

  private updateScores(): void {
    this.board.teams.forEach(team => {
      team.totalScore = team.scores.reduce((a,b) => a + b, 0);
    });
    this.board.categories.forEach((category, index) => {
      category.lowScore = this.board.teams.map(team => team.scores[index]).reduce((a,b) => Math.min(a, b), Infinity);
      category.highScore = this.board.teams.map(team => team.scores[index]).reduce((a,b) => Math.max(a, b), 0);
    });
  }

  private resetBoard(): void {
    //this.__debugTestFillBoard();
    this.board.teams = [];
    this.board.categories = [];
    for (let i = 0; i < 1; i += 1) {
      this.board.categories.push({ name: `Category ${i + 1}`, highScore: 0, lowScore: 0});
    }
    for (let i = 0; i < 4; i += 1) {
      const scores = this.board.categories.map(_ => 0);
      this.board.teams.push({ scores, name: `Team ${i + 1}`, totalScore: 0 });
    }
    this.updateScores();
    this.saveState();
  }
  
  private __debugTestFillBoard(): void {
    this.board.teams = [];
    this.board.categories = [];
    for (let i = 0; i < 8; i += 1) {
      this.board.categories.push({ name: `Category ${i + 1}`, highScore: 0, lowScore: 0});
    }
    for (let i = 0; i < 4; i += 1) {
      const scores = this.board.categories.map(_ => Math.round(Math.random() * 24));
      this.board.teams.push({ scores, name: `Team ${i + 1}`, totalScore: 0 });
    }
    this.updateScores();
    this.saveState();
  }

  private saveState(): void {
    localStorage.setItem(this.title, JSON.stringify(this.board));
  }
}
