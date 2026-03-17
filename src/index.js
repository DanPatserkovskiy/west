import Card from './Card.js';
import Game from './Game.js';
import TaskQueue from './TaskQueue.js';
import SpeedRate from './SpeedRate.js';
import card from "./Card.js";

// Отвечает является ли карта уткой.
function isDuck(card) {
    return card instanceof Duck;
}

// Отвечает является ли карта собакой.
function isDog(card) {
    return card instanceof Dog;
}

// Дает описание существа по схожести с утками и собаками
function getCreatureDescription(card) {
    if (isDuck(card) && isDog(card)) {
        return 'Утка-Собака';
    }
    if (isDuck(card)) {
        return 'Утка';
    }
    if (isDog(card)) {
        return 'Собака';
    }
    return 'Существо';
}

class Creature extends Card {
    constructor(name, power) {
        super(name, power);
        this._currentPower = power;
    }

    get currentPower() {
        return this._currentPower;
    }

    set currentPower(value) {
        this._currentPower = Math.min(value, this.maxPower);
    }
}

// Основа для утки.
class Duck extends Creature {
    constructor(name = 'Мирный житель', power = 2) {
        super(name, power);
    }

    quacks() {
        console.log('quack');
    }

    swims() {
        console.log('float: both;');
    }
};

// Основа для собаки.
class Dog extends Creature {
    constructor(name = 'Бандит', power = 3) {
        super(name, power);
    }
}

class Gatling extends Creature {
    constructor(name = 'Гатлинг', power = 6){
        super(name, power);
    }

    attack(gameContext, continuation) {
        const taskQueue = new TaskQueue();

        const {currentPlayer, oppositePlayer, position, updateView} = gameContext;
        const oppositeTable = gameContext.oppositePlayer.table;
        for (let i = 0; i < oppositeTable.length; i++) {
            taskQueue.push(onDone => this.view.showAttack(onDone));
            taskQueue.push(onDone => {
                const oppositeCard = oppositeTable[i];
                this.dealDamageToCreature(2, oppositeCard, gameContext, onDone);
            });
        }

        taskQueue.continueWith(continuation);
    }
}

class Brewer extends Duck {
    constructor(name = 'Пивовар', power = 2) {
        super(name, power);
    }

    attack(gameContext, continuation) {
        const taskQueue = new TaskQueue();
        const {currentPlayer, oppositePlayer} = gameContext;
        const allCards = currentPlayer.table.concat(oppositePlayer.table);

        for (let i = 0; i < allCards.length; i++) {
            const card = allCards[i];
            if (!card) continue;
            taskQueue.push(onDone => {
                if (card.isDuck) {
                    card.maxPower += 1;
                    card.currentPower += 2;
                    this.view.signalHeal(card, onDone);
                    card.updateView();
                } else {
                    onDone();
                }
            });
        }
        taskQueue.push(onDone => {
            super.attack(gameContext, onDone);
        });

        taskQueue.continueWith(continuation);
    }
}

class Trasher extends Dog {
    constructor(name = 'Громила', power = 5) {
        super(name, power);
    }

    modifyTakenDamage(value, fromCard, gameContext, continuation) {
        this.view.signalAbility(() => {
            continuation(value - 1);
        });
    }

    getDescriptions() {
        return [getCreatureDescription(this), ...super.getDescriptions(), "Если Громилу атакуют, то он получает на 1 меньше урона."];
    }
}

class Lad extends Dog {
    constructor(name = 'Браток', power = 2) {
        super(name, power);
    }

    static getInGameCount() {
        return this.inGameCount || 0;
    }

    static setInGameCount(value) {
        this.inGameCount = value;
    }

    doAfterComingIntoPlay(gameContext, continuation) {
        Lad.setInGameCount(Lad.getInGameCount() + 1);
        continuation();
    }

    doBeforeRemoving(continuation) {
        Lad.setInGameCount(Lad.getInGameCount() - 1);
        continuation();
    }

    static getBonus() {
        const ladsCount = this.getInGameCount();
        return ladsCount * (ladsCount + 1) / 2
    }

    modifyDealedDamageToCreature(value, toCard, gameContext, continuation) {
        this.view.signalAbility(() => {
            continuation(value + Lad.getBonus());
        });
    };

    modifyTakenDamage(value, toCard, gameContext, continuation) {
        const damage = value - Lad.getBonus();
        this.view.signalAbility(() => {
            continuation(damage > 0 ? damage : 0);
        });
    };

    getDescriptions() {
        const descriptions = [getCreatureDescription(this), ...super.getDescriptions()];
        if (Lad.prototype.hasOwnProperty('modifyDealedDamageToCreature')) {
            descriptions.push("Чем их больше, тем они сильнее");
        }
        return descriptions;
    }
}

class Rogue extends Creature {
    constructor(name = 'Изгой', power = 2) {
        super(name, power);
    }

    static get STEALABLE_ABILITIES() {
        return ['modifyDealedDamageToCreature', 'modifyDealedDamageToPlayer', 'modifyTakenDamage'];
    }

    doBeforeAttack(gameContext, continuation) {
        const { currentPlayer, oppositePlayer, updateView } = gameContext;

        const targetCard = oppositePlayer.table[0];

        if (targetCard && !(targetCard instanceof Rogue)) {
            this.stealAbilities(targetCard);
            updateView();
        }

        continuation();
    }

    stealAbilities(card) {
        const cardProto = Object.getPrototypeOf(card);
        const rogueProto = Object.getPrototypeOf(this);

        if (cardProto === rogueProto) {
            return;
        }

        for (const abilityName of Rogue.STEALABLE_ABILITIES) {
            if (cardProto.hasOwnProperty(abilityName)) {
                const stolenAbility = cardProto[abilityName];

                if (!this.hasOwnProperty(abilityName)) {
                    this[abilityName] = stolenAbility;
                }

                delete cardProto[abilityName];
            }
        }
    }
}

const seriffStartDeck = [
    new Duck(),
    new Rogue(),
    new Duck(),
    new Duck(),
];
const banditStartDeck = [
    new Lad(),
    new Lad(),
    new Lad(),
];

/*const seriffStartDeck = [
    new Duck(),
    new Duck(),
    new Duck(),
    new Gatling(),
];
const banditStartDeck = [
    new Trasher(),
    new Dog(),
    new Dog(),
];*/

// const seriffStartDeck = [
//     new Duck(),
//     new Duck(),
//     new Duck(),
// ];
// const banditStartDeck = [
//     new Dog(),
// ];

// const seriffStartDeck = [
//     new Duck(),
//     new Duck(),
//     new Duck(),
//     new Duck(),
// ];
// const banditStartDeck = [
//     new Trasher(),
// ];

// const seriffStartDeck = [
//     new Duck(),
//     new Duck(),
//     new Duck(),
// ];
// const banditStartDeck = [
//     new Lad(),
//     new Lad(),
// ];


// Колода Шерифа, нижнего игрока.
// const seriffStartDeck = [
//     new Duck('Мирный житель', 2),
//     new Duck('Мирный житель', 2),
//     new Duck('Мирный житель', 2),
// ];
//
// // Колода Бандита, верхнего игрока.
// const banditStartDeck = [
//     new Dog('Бандит', 3),
// ];


// Создание игры.
const game = new Game(seriffStartDeck, banditStartDeck);

// Глобальный объект, позволяющий управлять скоростью всех анимаций.
SpeedRate.set(1);

// Запуск игры.
game.play(false, (winner) => {
    alert('Победил ' + winner.name);
});
