import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { EditorComponent } from './editor.component';
import { ScoreboardRendererComponent } from './scoreboard-renderer.component';
import { ScoreboardComponent } from './scoreboard.component';

@NgModule({
  declarations: [
    AppComponent,
    EditorComponent,
    ScoreboardComponent,
    ScoreboardRendererComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
