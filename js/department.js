var department = new Vue({
	el: '#departmentBox',
	data: {
		department: null,
		deI: 0,
		simple: [
			['pr百尺肝头', 'ae更进一步'],
			['建站三番议', '随手千万行'],
			['手握五车钱', '监管十分严'],
			['十步叠图层', '千里挖素材'],
			['力量予自然', '自然创新篇'],
			['正当弃繻年', '梦笔有花开']
		],
		name: ['视频部', '网站部', '办公室', '图文部', '采风部', '采编部'],
		content: [
			' 视频部主要负责学校各类大型活动的制片和完成校内各组织的视频委托。我们的工作包含但不限于：视频创意的构思、视频拍摄的指导、视频片段的后期剪辑。如果你时常有创意有法，想用视频展现出来，或者对视频制作充满兴趣，那快来加入吧!我们期待技术大咖、热情的小伙子、温婉的小妹纸等等各种性格的人一起到我们这个大家庭里来!有责任有热情有想法的小伙伴皆可来组团搞事情哟！因为我们更多的，是需要拥有一颗有趣灵魂的你，毕竟，在我们这个技术大家庭里，0基础也能变为影视大咖哟!',
			' 网站部门在工作室中的主要职责在于工作室官方网站的规划、建设与维护，不断提高网页技术含量，搞好版面编排；营造积极健康的网络气氛，引领校园网络文化，运用网络信息资源为同学们提供方便，并为工作室其他各部门提供电子技术支持，在NEWX大学生网络文化工作室的工作中具有不可取代的地位，现阶段部门主要作品有工作室主站的PC端、移动端，空教室查询，失物招领小程序等。加入网站部，无论你是大佬还是萌新，我们都将为你们提供良好的学习网络技术的平台，给你们与人交流展示自己才能的机会！',
			' 办公室在工作室中起着统筹全局、联系各部门的作用，是工作室运作的枢纽，也是必不可缺的一个部门。在平时做好排班值班、卫生监管、资料整理、文件保存等工作；举办大型活动时，发挥创意并通过策划活动紧扣校园时事、推广校园文化，协调各部门做好经费预算，置办设备物资、活动用品，形成活动策划，做好活动前期准备，做好各部门同一任务的交接工作及进度监督，活动结束后，进行活动总结整理、吸取经验教训。办公室的作用是多方面的，主要是上传下达，沟通协调，汇集同学的意见，与负责老师沟通，负责并处理工作室的许多日常工作等，是整个工作室的一个重要组成部分。',
			' 图文项目部主要负责工作室以及学校宣传工作的视觉设计，旨在传达学校意愿，体现同学风采，服务老师和同学，丰富同学们的校园生活。图文部的日常工作主要通过PS、AI、C4D等软件完成，在这里，你可以锻炼自身设计能力，提高审美素养，不断成长进步。图文部会提供一个良好的氛围与平台供你发挥你的才能，让你交到志同道合的朋友。只要你有对美的追求，只要你愿意付出时间去实现你的奇思妙想，那么图文部就是你实现构想的舞台。',
			' 采风项目部是网文工作室旗下负责日常摄影供图、活动记录拍摄的技术部门。部门成员掌握平面摄影与影视制作所需的技能并有着良好的审美与艺术追求。对于新成员也积极开展有关平面摄影、影视摄像、灯光、录音、剪辑、调色等相关方面专业技能的培训。在过去的一年中，采风部承接了校运动会、迎新晚会、毕业晚会、各类校级文艺赛事等大型会议活动拍摄记录工作，也接受了校园其他部门制作宣传片、微电影的委托。',
			' 采编部主要负责校区官方微信公众号“合工大宣城校区学生工作”的运营管理，同时兼有组织采访学校中大型活动等校园新媒体工作。采编部立足校园，放眼社会，从学生日常生活、学习、心理等方面出发，撰写实时推文，紧跟时代热点，契合受众阅读需求；编写校区新闻，发布实时通知与学校成就；把握青年脉搏，切实发挥思想引领作用。坚持在校期间每日一推，保证推文质量稳定、高质的同时坚持原创，鼓励创意，追求创新，展现校区风采。服务老师，服务同学，服务家长，想青年所想，为青年发声。'
		],	
      imgs: ['http://img.wh241.cn/blog/20190905/IwmYlLkT1GWs.jpg?imageslim',
			'http://img.wh241.cn/blog/20190905/OkUSOVOxnftY.jpg?imageslim',
			'http://img.wh241.cn/blog/20190905/ftgsHIEC7oAS.jpg?imageslim',
			'http://img.wh241.cn/blog/20190905/OdfoBniPW5gI.jpg?imageslim',
			'http://img.wh241.cn/blog/20190905/o8n6qmWB5zxa.jpg?imageslim',
			'http://img.wh241.cn/blog/20190905/DYFOwjpYDupi.jpg?imageslim'
		]
	},
	methods: {
		getQueryVariable(variable) {
			var query = window.location.search.substring(1);
			var vars = query.split("&");
			for (var i = 0; i < vars.length; i++) {
				var pair = vars[i].split("=");
				if (pair[0] == variable) {
					return pair[1];
				}
			}
			return (false);
		}
	},
	mounted() {
		this.department = this.getQueryVariable('department');
		var color = ['#53b7e0', 'rgb(255, 196, 0)', '#e8e87e', '#778899', '#2afd9d', '#f29090'];

		if (this.department == 'video') {
			this.deI = 0;
		} else if (this.department == 'web') {
			this.deI = 1;
		} else if (this.department == 'office') {
			this.deI = 2;
		} else if (this.department == 'graphics') {
			this.deI = 3;
		} else if (this.department == 'collect') {
			this.deI = 4;
		} else if (this.department == 'edit') {
			this.deI = 5;
		}

		var FW = this.$el.clientWidth;
		this.$el.style.height = FW * 1.5 + 'px';
		this.$el.style.marginTop = FW * 0.2 + 'px';
		// this.$el.style.marginTop = (window.screen.height - this.$el.clientHeight) / 2 + 'px';
		this.$refs.dePicBox.style.height = this.$refs.dePicBox.clientWidth + 'px';
		this.$refs.dePicBox.children[0].style.backgroundColor = color[this.deI];
		// console.log(this.deI + color[this.deI])

		this.$refs.dePic.style.backgroundPositionY = -(this.$refs.dePic.clientHeight * this.deI) * 0.986 + 'px';

		// console.log(-(this.Hei * this.deI) * 0.986 + 'px');
		this.$refs.simple.style.fontSize = FW * 0.05 + 'px';
		this.$refs.deContent.style.fontSize = FW * 0.04 + 'px';
		this.$refs.deName.style.fontSize = FW * 0.06 + 'px';
		this.$refs.deName.style.color = color[this.deI];
		this.$refs.botMore.style.fontSize = FW * 0.05 + 'px';
		this.$refs.botMore.style.borderColor = color[this.deI];
		this.$refs.botMore.style.color = color[this.deI];
		this.$refs.botMore.style.borderRadius = FW * 0.8 + 'px';
	}
})
