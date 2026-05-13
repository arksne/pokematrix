import re

with open('/home/meow/Документы/LeaguePM/LeaguePM/index.html', 'r') as f:
    html = f.read()

# Replace l17-battle-arena content
new_arena = """      <div class="l17-battle-arena">
        
        <div class="l17-battle-grid">
          
          <!-- LEFT PANEL -->
          <div class="l17-side-panel">
            <div class="l17-poke-card">
              <div class="l17-sprite-box">
                <img class="l17-sprite player-sprite" id="player-sprite" src="" alt="player">
                <div class="l17-poke-status-icons" id="player-status-icons"></div>
              </div>
              <div class="l17-info-box">
                <div class="l17-name-row">
                  <span id="player-name" class="l17-poke-name">Groudon</span>
                  <span id="player-lvl" class="l17-poke-lvl">50-lvl</span>
                </div>
                <div class="l17-hp-wrap">
                  <div class="l17-hp-bar">
                    <div class="l17-hp-fill" id="player-hp-fill"></div>
                  </div>
                </div>
                <div class="l17-exp-wrap">
                  <div class="l17-exp-fill" id="player-exp-fill"></div>
                </div>
              </div>
            </div>
            <div class="l17-team-balls" id="player-team-balls">
              <!-- Team pokeballs will go here -->
            </div>
          </div>

          <!-- CENTER PANEL -->
          <div class="l17-center-panel">
            
            <div class="l17-attacks-container" id="battle-moves-menu">
              <div class="l17-attack-link" id="move-btn-0">-</div>
              <div class="l17-attack-link" id="move-btn-1">-</div>
              <div class="l17-attack-link" id="move-btn-2">-</div>
              <div class="l17-attack-link" id="move-btn-3">-</div>
            </div>

            <div class="l17-inventory-row" id="battle-inventory-menu">
              <span>Инвентарь: </span>
              <select class="l17-select" id="battle-item-select">
                <option value="pokeball">Монстробол</option>
                <option value="potion">Аптечка</option>
              </select>
              <button class="l17-btn-small" id="btn-use-item">Use</button>
              <span class="l17-divider">|</span>
              <span class="l17-run-link" id="btn-run">сбежать</span>
            </div>

            <div class="l17-end-row" id="battle-end-menu" style="display:none;">
              <button class="l17-btn-small" id="btn-leave-battle">Уйти с поля боя</button>
            </div>

            <div class="l17-battle-log-container">
              <div class="l17-battle-log" id="battle-log"></div>
            </div>

          </div>

          <!-- RIGHT PANEL -->
          <div class="l17-side-panel">
            <div class="l17-poke-card">
              <div class="l17-sprite-box">
                <img class="l17-sprite wild-sprite" id="wild-sprite" src="" alt="wild">
                <div class="l17-poke-status-icons" id="wild-status-icons"></div>
              </div>
              <div class="l17-info-box">
                <div class="l17-name-row">
                  <span id="wild-name" class="l17-poke-name">Pidgey</span>
                  <span id="wild-lvl" class="l17-poke-lvl">5-lvl</span>
                </div>
                <div class="l17-hp-wrap">
                  <div class="l17-hp-bar">
                    <div class="l17-hp-fill" id="wild-hp-fill"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>"""

start_idx = html.find('<div class="l17-battle-arena">')
end_idx = html.find('<!-- FOOTER -->')
if end_idx == -1: end_idx = html.find('</div>\n    </div>\n\n  </body>')

# Adjust end_idx to properly encapsulate the modal-overlay
end_idx = html.find('</div>\n    </div>\n\n  </body>')
# Actually, the arena ends before FOOTER, wait there is no footer.
end_arena_idx = html.find('</div>\n    </div>\n\n    <!-- Scripts -->')
if end_arena_idx == -1: end_arena_idx = html.find('</div>\n    </div>\n\n  <script')
if end_arena_idx == -1: end_arena_idx = html.find('</main>') # Wait no, encounter-modal is outside main.

start_encounter = html.find('<div id="encounter-modal" class="modal-overlay">')
end_encounter = html.find('<!-- Scripts -->')
if start_encounter != -1 and end_encounter != -1:
    old_modal = html[start_encounter:end_encounter]
    new_modal = f"""<div id="encounter-modal" class="modal-overlay" style="display:none;">
{new_arena}
    </div>

    """
    html = html.replace(old_modal, new_modal)

with open('/home/meow/Документы/LeaguePM/LeaguePM/index.html', 'w') as f:
    f.write(html)
