import os

with open('/home/meow/Документы/LeaguePM/LeaguePM/main.js', 'r') as f:
    code = f.read()

# 1. log.innerText = `На вас напал дикий ${activeWild.name}!`;
code = code.replace("battleLog.innerText = `На вас напал дикий ${activeWild.name}!`;", "appendToLog(`На вас напал дикий ${activeWild.name}!`, true);")
code = code.replace("battleLog.innerText = 'Ищем...';", "appendToLog('Ищем...', true);")

# 2. useMove
code = code.replace("log.innerText = `${activePlayerMon.apiData.name} использует ${move.name}!`;", "appendToLog(`${activePlayerMon.apiData.name} использует ${move.name}!`);")
code = code.replace("log.innerText += ' Но ничего не произошло...';", "appendToLog('Но ничего не произошло...');")
code = code.replace("log.innerText += ' Это суперэффективно!';", "appendToLog('Это суперэффективно!');")
code = code.replace("log.innerText += ' Это малоэффективно...';", "appendToLog('Это малоэффективно...');")
code = code.replace("log.innerText += ' Атака не возымела эффекта...';", "appendToLog('Атака не возымела эффекта...');")
code = code.replace("log.innerText = `Дикий ${activeWild.name} побежден!`;", "appendToLog(`Дикий ${activeWild.name} побежден!`);")
code = code.replace("log.innerText += ` ${activePlayerMon.apiData.name} получил ${expGain} EXP!`;", "appendToLog(`${activePlayerMon.apiData.name} получил ${expGain} EXP!`);")
code = code.replace("log.innerText += ` ${activePlayerMon.apiData.name} достиг ${activePlayerMon.baseLevel} уровня!`;", "appendToLog(`${activePlayerMon.apiData.name} достиг ${activePlayerMon.baseLevel} уровня!`);")

# 3. enemyTurn
code = code.replace("log.innerText = `Дикий ${activeWild.name} атакует!`;", "appendToLog(`Дикий ${activeWild.name} атакует!`);")
code = code.replace("log.innerText = `${activePlayerMon.apiData.name} потерял сознание! Вы проиграли.`;", "appendToLog(`${activePlayerMon.apiData.name} потерял сознание! Вы проиграли.`);")
code = code.replace("log.innerText = 'Что будете делать?';", "")

with open('/home/meow/Документы/LeaguePM/LeaguePM/main.js', 'w') as f:
    f.write(code)
