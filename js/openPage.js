var img = new Image();


var arrWord = ['我', '们', '可', '以', '帮', '助', '你', '<br><br>'];
var changeArrWord = [
	['描<div class="textLine"></div>', '绘<div class="textLine"></div>', '&nbsp&nbsp', '梦<div class="textLine"></div>',
		'想<div class="textLine"></div>', '的<div class="textLine"></div>', '蓝<div class="textLine"></div>',
		'图<div class="textLine"></div>'
	],
	['记<div class="textLine"></div>', '录<div class="textLine"></div>', '&nbsp&nbsp', '青<div class="textLine"></div>',
		'春<div class="textLine"></div>', '的<div class="textLine"></div>', '风<div class="textLine"></div>',
		'采<div class="textLine"></div>'
	],
	['打<div class="textLine"></div>', '造<div class="textLine"></div>', '&nbsp&nbsp', '创<div class="textLine"></div>',
		'造<div class="textLine"></div>', '的<div class="textLine"></div>', '舞<div class="textLine"></div>',
		'台<div class="textLine"></div>'
	],
	['勾<div class="textLine"></div>', '勒<div class="textLine"></div>', '&nbsp&nbsp', '灵<div class="textLine"></div>',
		'感<div class="textLine"></div>', '的<div class="textLine"></div>', '框<div class="textLine"></div>',
		'线<div class="textLine"></div>'
	]
];
var color = ['#98c6de', '#e4e59f', '#eeb6ba', '#65f2b5']


var sur = document.getElementById('sur');
var wefont = document.getElementById('wefont');
var disa = document.getElementById('disa');
var disaBor = document.getElementById('disaBor');

wefont.style.height = document.body.clientWidth * 0.25 + 'px';
sur.style.height = document.body.clientWidth * 1.4993 + 'px';

function GR(min, max) {
	return min + Math.floor(Math.random() * (max - min));
}

var index = 0;
var flag = 0;
var timerBor = null;
var timer = null;
var borWidth = document.body.clientWidth;



var timerColor = null;
var changeArrTimer = null;
var changeArrShowTimer = null;
var changeArrDeTimer = null;
var stopChange = null;


function openAnimation() {
	timer = setInterval(function() {
		if (index >= arrWord.length) {
			clearInterval(timer);
			disa.style.width = "30%";
			disa.style.fontSize = borWidth * 0.053 + 'px';
			disaBor.style.width = borWidth * 0.3 + 'px';
			disaBor.style.height = disaBor.clientWidth + 'px';
			var deg = 0;
			timerBor = setInterval(function() {
				deg = deg + 10;
				disaBor.style.transform = "rotate(" + deg + "deg)";
			}, 100)
			return;
		}
		wefont.children[index].innerHTML += arrWord[index];
		wefont.children[index].style.fontSize = borWidth * 0.053 + 'px';
		index++;
	}, 300)

	timerColor = setInterval(function() {
		var colorIndex1 = GR(0, 4)
		var colorIndex2 = GR(0, 4)
		var colorIndex3 = GR(0, 4)
		for (var i = 0; i < wefont.children.length; i++) {
			wefont.children[i].style.color = color[GR(0, 4)];
			if (wefont.children[i].children[0]) {
				if (i - 8 <= 2) {
					wefont.children[i].children[0].style.backgroundColor = color[colorIndex1]
				} else {
					wefont.children[i].children[0].style.backgroundColor = color[colorIndex2]
				}
			}
		}
		disaBor.style.borderColor = color[GR(0, 4)];
	}, 600)

	var changeIndex = 0;
	var changeWordIndex = 0;

	changeArrTimer = setInterval(function() {
		changeArrShowTimer = setInterval(function() {
			if (changeWordIndex >= changeArrWord[changeIndex].length) {
				clearInterval(changeArrShowTimer);
				stopChange = setTimeout(function() {
					changeArrDeTimer = setInterval(function() {
						changeWordIndex--;
						if (changeWordIndex < 0) {
							clearInterval(changeArrDeTimer)
							changeIndex++;
							if (changeIndex >= 4) {
								changeIndex = 0;
							}
							changeWordIndex = 0;
							return;
						}
						wefont.children[changeWordIndex + 8].innerHTML = '';
						wefont.children[changeWordIndex + 8].style.fontSize = 0;
					}, 50)
				}, 1400);
				return;
			}
			wefont.children[changeWordIndex + 8].innerHTML += changeArrWord[changeIndex][changeWordIndex];
			wefont.children[changeWordIndex + 8].style.fontSize = borWidth * 0.053 + 'px';
			changeWordIndex++;
		}, 100);

	}, 3200);


}


function clearAnimation() {

	for (var i = 0; i < wefont.children.length; i++) {
		wefont.children[i].innerHTML = '';
	}

	index = 0;
	clearInterval(timer);
	clearInterval(timerBor);
	clearInterval(timerColor);
	clearInterval(changeArrTimer);
	clearInterval(changeArrShowTimer);
	clearInterval(changeArrDeTimer);

	clearTimeout(stopChange);
}

window.onload = function() {
	openAnimation();
}

var bowhidden = "hidden" in document ? "hidden" : "webkithidden" in document ? "webkithidden" : "mozhidden" in document ?
	"mozhidden" : null;
var vibchage = "visibilitychange" || "webkitvisibilitychange" || "mozvisibilitychange";
document.addEventListener(vibchage, function() {
	/*ie10+  moz  webkit  默认*/
	if (!document[bowhidden]) /*false*/ {
		// console.log("激活");
		openAnimation();
	} else {
		/*true*/
		// console.log("隐藏");
		clearAnimation();
	}
});


var oInput = document.getElementById('disa');
var sur = document.getElementById('sur');
oInput.onclick = function() {
	sur.style.width = 0 + "px";
	sur.style.height = 0 + "px";
	sur.style.borderRadius = 10000 + "px";
	sur.style.opacity = 0;
	sur.style.top = 500 + 'px';
	clearAnimation();
	setTimeout(function() {
		window.open("index1.html", "_self");
	}, 800)
}
