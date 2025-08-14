// Zalgo class for cryptic messages generation
export class Zalgo {
    static up = [
        '\u030d', '\u030e', '\u0304', '\u0305', '\u033f', '\u0311', '\u0306', '\u0310',
        '\u0352', '\u0357', '\u0351', '\u0307', '\u0308', '\u030a', '\u0342', '\u0343',
        '\u0344', '\u034a', '\u034b', '\u034c', '\u0303', '\u0302', '\u030c', '\u0350',
        '\u0300', '\u0301', '\u030b', '\u030f', '\u0312', '\u0313', '\u0314', '\u033d',
        '\u0309', '\u0363', '\u0364', '\u0365', '\u0366', '\u0367', '\u0368', '\u0369',
        '\u036a', '\u036b', '\u036c', '\u036d', '\u036e', '\u036f', '\u033e', '\u035b',
        '\u0346', '\u031a'
    ];
    static down = [
        '\u0316', '\u0317', '\u0318', '\u0319', '\u031c', '\u031d', '\u031e', '\u031f',
        '\u0320', '\u0324', '\u0325', '\u0326', '\u0329', '\u032a', '\u032b', '\u032c',
        '\u032d', '\u032e', '\u032f', '\u0330', '\u0331', '\u0332', '\u0333', '\u0339',
        '\u033a', '\u033b', '\u033c', '\u0345', '\u0347', '\u0348', '\u0349', '\u034d',
        '\u034e', '\u0353', '\u0354', '\u0355', '\u0356', '\u0359', '\u035a', '\u0323'
    ];
    static mid = [
        '\u0315', '\u031b', '\u0340', '\u0341', '\u0358', '\u0321', '\u0322', '\u0327',
        '\u0328', '\u0334', '\u0335', '\u0336', '\u034f', '\u035c', '\u035d', '\u035e',
        '\u035f', '\u0360', '\u0362', '\u0338', '\u0337', '\u0361', '\u0489'
    ];
    //generates a ZALGO string with an arbitrary level of chaos.
    //text - source text
    //upcount - the number of symbols of the "chaos" from above (by default 3)
    //midcount - the number of symbols "chaos" in the middle (by default 1)
    //downcount - the number of symbols of "chaos" from below (by default 2)
    static fullText(text, upCount = 3, midCount = 1, downCount = 2) {
        return text.split('').map(char => {
            let result = char;
            result += Zalgo.randomChars(Zalgo.up, upCount);
            result += Zalgo.randomChars(Zalgo.mid, midCount);
            result += Zalgo.randomChars(Zalgo.down, downCount);
            return result;
        }).join('');
    }
    //Zalgo only at the top
    static upText(text, count = 3) {
        return text.split('').map(char => char + Zalgo.randomChars(Zalgo.up, count)).join('');
    }
    //Zalgo only in the middle part
    static midText(text, count = 2) {
        return text.split('').map(char => char + Zalgo.randomChars(Zalgo.mid, count)).join('');
    }
    //Zalgo only in the lower part
    static downText(text, count = 3) {
        return text.split('').map(char => char + Zalgo.randomChars(Zalgo.down, count)).join('');
    }
    //Method for generating random characters from the set
    static randomChars(arr, count) {
        let out = '';
        for (let i = 0; i < count; i++) {
            out += arr[Math.floor(Math.random() * arr.length)];
        }
        return out;
    }
}
