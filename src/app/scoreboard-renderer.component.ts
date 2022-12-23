// @t/s-nocheck

import { Component, OnInit } from '@angular/core';
import { RenderData } from './data-model';

interface Metrics {
    winnerRevealTime: number;
    timePerTeam: number;
    animationSteps: any[];
    totalDuration: number;
    fireworks: boolean;
    maxTeamName: string;
    maxCategoryTitle: string;
    highlights: any[];
    scoresFontSize: number;
    scoresFont: string;
    teamNameFontSize: number;
    teamNameFont: string;
    categoriesFontSize: number;
    categoriesFont: string;
}

interface DataModel extends RenderData {
    maxScore: number;
    totalScores: number[];
}

interface Firework {
    startTime: number,
    fuseTime: number,
    lifeTime: number,
    respawnTime: number,
    expandTime: number,
    startX: number,
    startY: number,
    bezierAX: number,
    bezierAY: number,
    bezierBX: number,
    bezierBY: number,
    targetX: number,
    targetY: number,
    radius: number,
    particles: number,
    color: number
};

@Component({
  selector: 'app-scoreboard-renderer',
  templateUrl: './scoreboard-renderer.component.html',
  styleUrls: ['./scoreboard-renderer.component.scss']
})
export class ScoreboardRendererComponent implements OnInit {

    canvas!: HTMLCanvasElement;
    ctx!: CanvasRenderingContext2D;

    fightClubEffectDelay = '';

    readonly animationBuffer = 10;

    // render metrics
    readonly gridLinesSpacingPts = 10;
    readonly outerPaddingPct = 0.01;
    readonly mainSectionWhitespaceWidthPct = 0.1;
    readonly teamNamesSectionHeightPct = 0.1;
    readonly categoriesSectionWidthPct = 0.11;
    readonly scoreLabelHeightPct = 0.05;
    readonly legendSectionWidthPct = 0.05;
    readonly defaultFontSize = 40;
    readonly minFontSize = 28;
    readonly gridLineWidth = 1;
    readonly winnerRevealTimeFactor = 0.98;
    // highlights
    readonly highlightsExpandTime = 250;
    readonly highlightsLifeTime = 800;
    readonly highlightAreaFactor = 0.08;
    // fireworks
    readonly fireworksMaxNumber = 8;
    readonly fireworksFuseMin = 400;
    readonly fireworksFuseWindow = 800;
    readonly fireworksLifeTimeMin = 1000;
    readonly fireworksLifeTimeWindow = 3000;
    readonly fireworksRespawnTimeMin = 0;
    readonly fireworksRespawnTimeWindow = 2500;
    readonly fireworksExpandTimeMin = 100;
    readonly fireworksExpandTimeWindow = 100;
    readonly fireworksParticlesMin = 16;
    readonly fireworksParticlesWindow = 20;
    readonly fireworksHorizontalPadding = 0.1;
    readonly fireworksRadiusMin = 0.07;
    readonly fireworksRadiusWindow = 0.10;
    readonly fireworksTargetXOffset = -0.15;
    readonly fireworksTargetXRange = 0.3;
    readonly fireworksGravityFactor = 0.5 * 9.81 / 1000000;
    readonly fireworksSmokeTrailLineWidth = 3;
    readonly fireworksSmokeTrailLineSegments = 20;
    readonly fireworksSmokeTrailLineSegmentsSteps = 0.02;

    // colors
    readonly scoreSectionBackground = "rgba(32,28,40, 0.5)";
    readonly gridColorStub = "rgba(128,128,128,";
    readonly gridColor = "rgba(128,128,128," + "1)";
    readonly textColor = "#b35900";
    readonly highlightStub = "rgba(255,255,255,";

    data!: DataModel;
    metrics!: Metrics;
    startTimestamp!: DOMHighResTimeStamp;
    fireworks!: Firework[];
    highlights: any[] = [];

    animationWindowIndex!: number;

    forceRestartFlag = false;
    booting = false;

    completed = false;

    zeroScoreGif = '';

    ngOnInit(): void {
    }

    triggerAnimation(): void {
        if (this.booting) {
            return;
        }
        this.zeroScoreGif = `./assets/zero_score_${Math.min(2, Math.max(0, Math.floor(Math.random() * 3)))}.gif`;
        this.fightClubEffectDelay = '';
        this.resetState();
        this.booting = true;
        this.canvas = document.getElementById("render_target") as HTMLCanvasElement;
        this.ctx = this.canvas.getContext("2d")!;
    
        setTimeout(() => {
            this.booting = false;
            this.forceRestartFlag = false;
            this.loadData();
            window.requestAnimationFrame(time => this.renderLoop(time));
        }, 250);
    }
      
    private loadData() {
        const renderData = (window as any).scoreboardData as RenderData;
        this.data = {...renderData, maxScore: 0, totalScores: [] };
        this.data.totalScores = new Array(this.data.teams.length).fill(0);
        for (let r = 0; r < this.data.scores.length; ++r) {
            for (let c = 0; c < this.data.scores[r].length; ++c) {
                this.data.totalScores[c] += this.data.scores[r][c];
            }
        }
        this.data.maxScore = this.data.totalScores.reduce((m, s) => Math.max(m, s), 0);
        this.metrics = {
            maxTeamName: this.data.teams.reduce((m, t) => m.length > t.length ? m : t, ""),
            maxCategoryTitle: this.data.categories.reduce((m, c) => m.length > c.length ? m : c, ""),
            animationSteps: this.data.totalScores.sort((a,b) => a - b),
            winnerRevealTime: this.winnerRevealTimeFactor * renderData.duration,
            timePerTeam: this.winnerRevealTimeFactor * renderData.duration / (this.data.teams.length - 1),
            highlights: new Array(this.data.teams.length).fill(null),
            totalDuration: renderData.duration,
            fireworks: renderData.fireworks
        } as Metrics;
        this.highlights = new Array(this.data.teams.length).fill(null);
        this.fightClubEffectDelay = this.data.categories?.length > 3 && Math.random() > 0.8 ? `${Math.round(Math.random() * 8) + 1}` : '';
    }

    private renderLoop(timestamp: DOMHighResTimeStamp) {
        if (this.forceRestartFlag) {
            this.resetState();
            this.triggerAnimation();
            return;
        }
        if (this.startTimestamp === undefined) {
            this.startTimestamp = timestamp;
            window.requestAnimationFrame(time => this.renderLoop(time));
            this.canvas!.width = window.innerWidth;
            this.canvas!.height = window.innerHeight;
            return;
        }

        const elapsed = timestamp - this.startTimestamp;

        // map elapsed time to slow down before animation steps

        let animationStepPts = this.data!.maxScore;

        if (elapsed < this.metrics.winnerRevealTime) {

            const animationWindowElapsed = elapsed % this.metrics.timePerTeam;

            let animationWindowStartImage = 0, animationWindowEndImage = this.data.maxScore;

            if (this.metrics.animationSteps.length > 1) {

                this.animationWindowIndex = Math.floor(elapsed / this.metrics!.timePerTeam) - 1;

                if (this.animationWindowIndex < 0) {
                    animationWindowEndImage = this.metrics.animationSteps[0];
                } else {
                    animationWindowStartImage = this.metrics.animationSteps[this.animationWindowIndex];
                    animationWindowEndImage = this.metrics.animationSteps[this.animationWindowIndex + 1];
                }
            }

            // let [d1, d2] be the animationWindowIndex-th time frame
            // map d in [d1, d2] -f-> [0, 100] -g-> [0, 100] -f^-1-> [animationWindowStart, animationWindowEnd]
            // f: linear transform
            // choose g s.t. g(0) = 0, g(100) = 100 and g strictly monotone
            // we chose g(d) = sqrt(d) * 10
            animationStepPts = this.linearTransform(10 * Math.sqrt(
                this.linearTransform(animationWindowElapsed, 0, this.metrics.timePerTeam, 0, 100)),
                0, 100, animationWindowStartImage, animationWindowEndImage);

        } else if (elapsed <= this.metrics.totalDuration) {
            // just use a linear mapping
            animationStepPts = this.linearTransform(elapsed - this.metrics.winnerRevealTime,
                0, this.metrics.totalDuration - this.metrics.winnerRevealTime,
                this.metrics.animationSteps[this.metrics.animationSteps.length - 2], this.data.maxScore);
        } else if (!this.metrics.fireworks && !this.highlights.some(h => h === null || elapsed < h.lifeTime)) {
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        //  ---------------------------------------------------------------------------
        // |                               outer padding                               |
        // |    -------------------------------------------------------------------    |
        // |   |         |                                                     |   |   |
        // |   |         |                    score labels                     |   |   |
        // |   |         |                                                     |   |   |
        // |   |         |--------------------------------------------- --- ---| g |   |
        // |   |    c    |           | |           | |           | |   |   |   | r |   |
        // |   |    a    |           | |           | |           | |   | m |   | i |   |
        // |   |    t    |    ---    | |           | |           | |   | a |   | d |   |
        // |   |    e    |   |   |   | |           | |    ---    | |   | x |   |   |   |
        // |   |    g    |   |   |   | |    ---    | |   |   |   | |   |   |   | l |   |
        // |   |    o    |   |   |   | |   |   |   | |   |   |   | |   | s |   | e |   |
        // |   |    r    |   |   |   | |   |   |   | |   |   |   | |   | c |   | g |   |
        // |   |    i    |   |   |   | |   |   |   | |   |   |   | |   | o |   | e |   |
        // |   |    e    |   |   |   | |   |   |   | |   |   |   | |   | r |   | n |   |
        // |   |    s    |   |   |   | |   |   |   | |   |   |   | |   | e |   | d |   |
        // |   |         |   |   |   | |   |   |   | |   |   |   | |   |   |   |   |   |
        // |   |         |-----------| |-----------| |-----------| |-----------|   |   |
        // |   |         |   team    | |   team    | |   team    | |   team    |   |   |
        // |   |         |   name    | |   name    | |   name    | |   name    |   |   |
        // |    -------------------------------------------------------------------    |
        // |                                                                           |
        //  ---------------------------------------------------------------------------

        const drawableAreaLeft = this.outerPaddingPct * this.canvas.width;
        const drawableAreaRight = (1 - this.outerPaddingPct) * this.canvas.width;
        const drawableAreaWidth = drawableAreaRight - drawableAreaLeft;
        const legendSectionWidth = this.legendSectionWidthPct * drawableAreaWidth;
        const categoriesSectionWidth = this.categoriesSectionWidthPct * drawableAreaWidth;
        const mainSectionLeft = drawableAreaLeft + categoriesSectionWidth;
        const mainSectionRight = drawableAreaRight - legendSectionWidth;
        const mainSectionWidth = mainSectionRight - mainSectionLeft;
        const teamColumnWidth = mainSectionWidth * (1 - this.mainSectionWhitespaceWidthPct) / this.data.teams.length;
        const scoreColumnWeight = 1 - (Math.min(Math.max(this.data.teams.length, 4), 10) - 4) / 6;
        const scoreColumnWidth = teamColumnWidth / (2 + scoreColumnWeight);
        const mainSectionWhitespaceWidth = mainSectionWidth * this.mainSectionWhitespaceWidthPct / (this.data.teams.length - 1);
        const mainSectionTeamColumnAndWhitespaceWidth = teamColumnWidth + mainSectionWhitespaceWidth;
        const teamColumnSemiWidth = teamColumnWidth / 2;
        const legendSectionSemiWidth = legendSectionWidth / 2;
        const categoriesSectionMid = drawableAreaLeft + categoriesSectionWidth / 2;

        const drawableAreaTop =  this.outerPaddingPct * this.canvas.height;
        const drawableAreaBottom =  (1 - this.outerPaddingPct) * this.canvas.height;
        const drawableAreaHeight = drawableAreaBottom - drawableAreaTop;
        const scoresSectionTop = drawableAreaTop + this.scoreLabelHeightPct * drawableAreaHeight;
        const scoresSectionBottom = drawableAreaBottom - this.teamNamesSectionHeightPct * drawableAreaHeight;
        const scoresSectionHeight = scoresSectionBottom - scoresSectionTop;
        const scoreLabelSectionHeight = scoresSectionTop - drawableAreaTop;
        const teamNamesSectionBaseline = (drawableAreaBottom + scoresSectionBottom) / 2;
        const scoreLabelSectionSemiHeight = scoreLabelSectionHeight / 2;

        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        // derive font size
        this.metrics.scoresFontSize = this.findOptimalFontSize(this.metrics.scoresFontSize, teamColumnWidth, "000.0");
        this.metrics.scoresFont = this.metrics.scoresFontSize + "px Monospace";

        this.metrics.teamNameFontSize = this.findOptimalFontSize(this.metrics.teamNameFontSize, teamColumnWidth, this.metrics.maxTeamName);
        this.metrics.teamNameFont = this.metrics.teamNameFontSize + "px Monospace";

        this.metrics.categoriesFontSize = this.findOptimalFontSize(this.metrics.categoriesFontSize, categoriesSectionWidth, this.metrics.maxCategoryTitle);
        this.metrics.categoriesFont = this.metrics.categoriesFontSize + "px Monospace";

        this.ctx.fillStyle = this.scoreSectionBackground;
        this.ctx.fillRect(mainSectionLeft, drawableAreaTop, mainSectionWidth, scoresSectionBottom - drawableAreaTop);

        // draw grid
        this.ctx.lineWidth = this.gridLineWidth;

        this.ctx.strokeStyle = this.createGridGradient(mainSectionLeft, mainSectionRight, this.gridColor, this.data.teams.length, mainSectionTeamColumnAndWhitespaceWidth, teamColumnSemiWidth);
        this.ctx.fillStyle = this.gridColor;
        this.ctx.beginPath();
        let topGrindLineBound = Math.min(animationStepPts, this.data.maxScore);
        let topGridLineScore = topGrindLineBound - (topGrindLineBound % 10);

        for (let i = 0; i <= topGridLineScore; i += this.gridLinesSpacingPts) {

            let y = scoresSectionBottom - i * scoresSectionHeight / this.data.maxScore;

            this.ctx.fillText("" + i, mainSectionRight + legendSectionSemiWidth, y, legendSectionWidth);

            this.ctx.moveTo(mainSectionLeft, y);
            this.ctx.lineTo(mainSectionRight, y);
        }

        this.ctx.stroke();

        // fade in next grind line
        let nextGridLineScore = topGridLineScore + this.gridLinesSpacingPts;

        if (nextGridLineScore <= this.data.maxScore) {

            this.ctx.beginPath();

            let color = this.gridColorStub + (1 - (nextGridLineScore - animationStepPts) / this.gridLinesSpacingPts) + ")";
            this.ctx.strokeStyle = this.createGridGradient(mainSectionLeft, mainSectionRight, color, this.data.teams.length,
                mainSectionTeamColumnAndWhitespaceWidth, teamColumnSemiWidth);
                this.ctx.fillStyle = color;

            let y = scoresSectionBottom - nextGridLineScore * scoresSectionHeight / this.data.maxScore;

            this.ctx.fillText("" + nextGridLineScore, mainSectionRight + legendSectionSemiWidth, y, legendSectionWidth);

            this.ctx.moveTo(mainSectionLeft, y);
            this.ctx.lineTo(mainSectionRight, y);

            this.ctx.stroke();
        }

        // draw main section

        const categoriesAlpha = new Array(this.data.categories.length).fill(0);
        const alphaIncrement = 1 / this.data.teams.length;
        const highlightArea = this.highlightAreaFactor * scoreColumnWidth;

        for (let t = 0; t < this.data.teams.length; ++t) {

            const left = mainSectionLeft + t * mainSectionTeamColumnAndWhitespaceWidth;

            this.ctx.font = this.metrics.teamNameFont;
            this.ctx.fillStyle = this.textColor;

            const getLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
                var words = text.split(" ");
                var lines = [];
                var currentLine = words[0];
            
                for (var i = 1; i < words.length; i++) {
                    var word = words[i];
                    var width = ctx.measureText(currentLine + " " + word).width;
                    if (width < maxWidth) {
                        currentLine += " " + word;
                    } else {
                        lines.push(currentLine);
                        currentLine = word;
                    }
                }
                lines.push(currentLine);
                return lines;
            };
            
            const lines = getLines(this.ctx, this.data.teams[t], teamColumnWidth);
            for (let l = 0; l < lines.length; l += 1) {
                this.ctx.fillText(lines[l], left + teamColumnSemiWidth, teamNamesSectionBaseline + (l - (lines.length - 1) / 2 ) * this.metrics.teamNameFontSize, teamColumnWidth);
            }

            let score = 0, nextScore;
            let cntn = true;
            let bottom = scoresSectionBottom, nextBottom;

            let scoreColumnLeft = left + teamColumnWidth/2 - scoreColumnWidth/2;

            const highlight = this.highlights[t];
            if (highlight !== null && elapsed < highlight.lifeTime) {

                let alpha;

                if (elapsed < highlight.expandTime) {
                    alpha = 1.0 - (highlight.expandTime - elapsed) / this.highlightsExpandTime;
                } else {
                    alpha = (highlight.lifeTime - elapsed) / this.highlightsLifeTime;
                }
                this.ctx.fillStyle = this.highlightStub + alpha + ")";
                this.ctx.fillRect(scoreColumnLeft - highlightArea,
                    bottom + highlightArea,
                    scoreColumnWidth + 2 * highlightArea,
                    highlight.height - 2 * highlightArea);
            }

            for (let c = 0; cntn && c < this.data.categories.length; ++c) {

                //const green = 128 + c * 128 / this.data.categories.length;
                const green = 128 + c * 128 / Math.max(this.data.categories.length, 3);
                this.ctx.fillStyle = "rgb(255," + (green) + ",0)";
                nextScore = score + this.data.scores[c][t];

                if (nextScore > animationStepPts) {
                    categoriesAlpha[c] += ((animationStepPts - score) / this.data.scores[c][t]) * alphaIncrement;
                    nextScore = animationStepPts;
                    cntn = false;
                } else {
                    categoriesAlpha[c] += alphaIncrement;
                }

                nextBottom = scoresSectionBottom - nextScore * scoresSectionHeight / this.data.maxScore;

                const savedStyle = this.ctx.fillStyle;
                const darkerGreen = 128 + (c - 4) * 128 / Math.max(this.data.categories.length, 9);
                this.ctx.fillStyle = "rgb(255," + (darkerGreen) + ",0)";
                this.ctx.fillRect(scoreColumnLeft,
                        nextBottom,
                        scoreColumnWidth,
                        bottom - nextBottom);
                this.ctx.fillStyle = savedStyle;
                this.ctx.fillRect(scoreColumnLeft,
                    nextBottom + 2,
                    scoreColumnWidth,
                    Math.max(bottom - nextBottom - 2, 0));

                score = nextScore;
                bottom = nextBottom;

                if (cntn && c == this.data.categories.length - 1 && highlight === null) {
                    this.createHighlight(elapsed, t, nextBottom - scoresSectionBottom);
                }
            }

            this.ctx.font = this.metrics.scoresFont;
            this.ctx.fillStyle = this.textColor;
            const emojiOnFire = `${highlight && this.data.scoreOnFire === this.data.scores[this.data.categories.length - 1][t] ? '🔥' : ''}`;
            const emojiOnIce = `${highlight && this.data.scoreOnIce === this.data.scores[this.data.categories.length - 1][t] ? '💩' : ''}`;
            this.ctx.fillText(`${highlight ? score : score.toFixed(1)}${emojiOnFire || emojiOnIce}`, left + teamColumnSemiWidth, bottom - scoreLabelSectionSemiHeight, teamColumnWidth);         

            if (highlight && this.data.trends) {
                const img = document.getElementById(this.data.trends[t] < 0 ? 'trendingUp' : this.data.trends[t] > 0 ? 'trendingDown' : 'trendingFlat') as HTMLImageElement;
                const scaledWidth = scoreColumnWidth * (0.5 - 0.15 * scoreColumnWeight);
                const scaledHeight = img.height * scaledWidth / img.width;
                this.ctx.drawImage(img, 0, 0, img.width, img.height, left + teamColumnSemiWidth - scaledWidth / 2, bottom, scaledWidth, scaledHeight);

                if (this.data.fireworks) {
                    this.ctx.font = this.metrics.scoresFont;
                    this.ctx.fillStyle = 'black';
                    this.ctx.fillText(`${this.data.placements[t]}`, left + teamColumnSemiWidth, bottom + scaledHeight * 2, scoreColumnWidth);         
                }
            }
        }

        // draw category names
        for (let c = 0; c < this.data.categories.length; ++c) {

            this.ctx.font = this.metrics.categoriesFont;
            this.ctx.fillStyle = "rgb(255," + (128 + c * 128 / this.data.categories.length) + ",0," + categoriesAlpha[c] + ")";
            this.ctx.fillText(this.data.categories[c],
                categoriesSectionMid,
                scoresSectionBottom - (c + 1) * scoresSectionHeight / (this.data.categories.length + 1),
                categoriesSectionWidth);
        }

        // fireworks
        if (animationStepPts >= this.data.maxScore) {
            this.completed = true;
        }
        if (this.metrics.fireworks && animationStepPts >= this.data.maxScore) {

            if (this.fireworks === undefined) {
                this.fireworks = new Array(this.fireworksMaxNumber);
            }
            for (let i = 0; i < this.fireworksMaxNumber; ++i) {
                if (this.fireworks[i] === undefined || this.fireworks[i].respawnTime < elapsed) {
                    this.createFirework(elapsed, i);
                }
            }

            this.ctx.lineWidth = this.fireworksSmokeTrailLineWidth;
            const radiusScale = Math.min(drawableAreaWidth, drawableAreaHeight);

            for (const firework of this.fireworks) {

                if (firework.lifeTime < elapsed) {
                    continue;
                }

                let age = elapsed - firework.startTime;

                if (age < firework.fuseTime) {

                    const ageFactor = age / firework.fuseTime;

                    let px = 0, py = 0;

                    for (let i = this.fireworksSmokeTrailLineSegments, td = ageFactor;
                        i > 0 && td >= 0;
                        --i, td -= this.fireworksSmokeTrailLineSegmentsSteps) {

                        const mtd = (1 - td);
                        const a = mtd * mtd * mtd;
                        const b = 3 * td * mtd * mtd;
                        const c = 3 * td * td * mtd;
                        const d = td * td * td;

                        const x = drawableAreaLeft + drawableAreaWidth * (
                            a * firework.startX +
                            b * firework.bezierAX +
                            c * firework.bezierBX +
                            d * firework.targetX);
                        const y = drawableAreaBottom - drawableAreaHeight * (
                            a * firework.startY +
                            b * firework.bezierAY +
                            c * firework.bezierBY +
                            d * firework.targetY);

                        if (i < 20) {
                            this.ctx.beginPath();
                            this.ctx.strokeStyle = "rgba(255, 255, 255, " + (i / this.fireworksSmokeTrailLineSegments) + ")";
                            this.ctx.moveTo(px, py);
                            this.ctx.lineTo(x, y);
                            this.ctx.stroke();
                        }

                        px = x;
                        py = y;
                    }

                    continue;
                }

                age -= firework.fuseTime;

                let radius = firework.radius;

                if (age < firework.expandTime) {
                    radius *= age / firework.expandTime;
                }

                const gravityOffY = this.fireworksGravityFactor * age * age;

                const alpha = Math.sin(this.linearTransform(age, 0, firework.lifeTime - firework.startTime - firework.fuseTime, Math.PI / 2, Math.PI));
                let colorInner = "hsla(" + firework.color + ", 100%, 70%, " + alpha + ")";
                let colorMid = "hsla(" + firework.color + ", 100%, 60%, " + 0.7 * alpha + ")";
                let colorOuter = "hsla(" + firework.color + ", 100%, 50%, " + 0.3 * alpha + ")";

                for (let p = 0; p < firework.particles; ++p) {

                    let x = drawableAreaLeft + firework.targetX * drawableAreaWidth + Math.cos(Math.PI * 2 * p / firework.particles) * radius * radiusScale;
                    let y = drawableAreaBottom + gravityOffY - firework.targetY * drawableAreaHeight + Math.sin(Math.PI * 2 * p / firework.particles) * radius * radiusScale;

                    this.ctx.beginPath();
                    this.ctx.fillStyle = colorOuter;
                    this.ctx.arc(x, y, 6, 0, 2 * Math.PI);
                    this.ctx.fill();

                    this.ctx.beginPath();
                    this.ctx.fillStyle = colorMid;
                    this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
                    this.ctx.fill();

                    this.ctx.beginPath();
                    this.ctx.fillStyle = colorInner;
                    this.ctx.arc(x, y, 2, 0, 2 * Math.PI);
                    this.ctx.fill();
                }
            }
        }

        window.requestAnimationFrame(time => this.renderLoop(time));
    }

    private findOptimalFontSize(fontSize: number, maxWidth: number, sampleText: string) {
        if (fontSize === undefined) {
            fontSize = this.defaultFontSize;
        }

        this.ctx.font = fontSize + "px Monospace";
        let textMeasurements = this.ctx.measureText(sampleText);

        if (textMeasurements.width < maxWidth) {
            return fontSize;
        }

        let min = this.minFontSize, max = fontSize;

        while (max - min > 3) {

            fontSize = Math.round((max + min) / 2);

            this.ctx.font = fontSize + "px Monospace";
            textMeasurements = this.ctx.measureText(sampleText);

            if (textMeasurements.width > maxWidth) {
                max = fontSize;
            } else {
                min = fontSize;
            }
        }

        return fontSize;
    }

    private linearTransform(x: number, dlb: number, dub: number, ilb: number, iub: number) {
        return ilb + (x - dlb) * (iub - ilb) / (dub - dlb);
    }

    private createGridGradient(left: number, right: number, col: string, teams: number, mainSectionTeamColumnAndWhitespaceWidth: number, teamColumnSemiWidth: number) {
        const width = right - left;
        let gridGradient = this.ctx.createLinearGradient(left, 0, right, 0);

        for (let t = 0; t < teams; ++t) {

            let x = t * mainSectionTeamColumnAndWhitespaceWidth;

            gridGradient.addColorStop(Math.max(Math.min(x / width, 0), 1), col);
            x += teamColumnSemiWidth;
            gridGradient.addColorStop(Math.max(Math.min(x / width, 0), 1), this.scoreSectionBackground);
            gridGradient.addColorStop(Math.max(Math.min((x + teamColumnSemiWidth) / width, 0), 1), col);
        }

        return gridGradient;
    }

    private createFirework(elapsed: number, i: number) {
        const fuseTime = this.fireworksFuseMin + Math.random() * this.fireworksFuseWindow;
        const lifeTime = elapsed + fuseTime + this.fireworksLifeTimeMin + Math.random() * this.fireworksLifeTimeWindow;

        const startX = this.fireworksHorizontalPadding + Math.random() * (1 - 2 * this.fireworksHorizontalPadding);

        const targetX = startX + this.fireworksTargetXOffset + Math.random() * this.fireworksTargetXRange;
        const targetY = 0.5 + Math.random() / 2;

        const ax = Math.random();
        const bx = Math.random();

        this.fireworks[i] = {
            startTime: elapsed,
            fuseTime: fuseTime,
            lifeTime: lifeTime,
            respawnTime: lifeTime + this.fireworksRespawnTimeMin + Math.random() * this.fireworksRespawnTimeWindow,
            expandTime: this.fireworksExpandTimeMin + Math.random() + this.fireworksExpandTimeWindow,
            startX: startX,
            startY: 0,
            bezierAX: startX * ax + targetX * (1 - ax),
            bezierAY: Math.random() * targetY,
            bezierBX: startX * bx + targetX * (1 - bx),
            bezierBY: Math.random() * targetY,
            targetX: targetX,
            targetY: targetY,
            radius: this.fireworksRadiusMin + Math.random() * this.fireworksRadiusWindow,
            particles: Math.round(this.fireworksParticlesMin + Math.random() * this.fireworksParticlesWindow),
            color: Math.random() * 360
        };
    }

    private createHighlight(elapsed: number, i: number, height: number) {
        this.highlights[i] = {
            expandTime: elapsed + this.highlightsExpandTime,
            lifeTime: elapsed + this.highlightsLifeTime,
            height: height
        };
    }

    private resetState(): void {
        this.data = undefined!;
        this.metrics = undefined!;
        this.startTimestamp = undefined!;
        this.fireworks = undefined!;
        this.highlights = [];
        this.completed = false;

        this.animationWindowIndex = undefined!;
    }
}
