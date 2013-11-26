$(document).ready(function () {
    var lastData = null;
    var buildServerDomain = 'build.esendex.com';
    var jobsToWatchRegex = new RegExp('^apps|^sdk|^Esendex.Specsavers', 'i'); 
    var displayStatuses = ['blue_anime', 'red', 'red_anime', 'aborted'];
    var buildBranches = {};

    setInterval(function () {
        $.ajax({
			url: 'http://'+ buildServerDomain +'/api/json?format=json&pretty=true&jsonp=?',
            dataType: 'jsonp',
			timeout: 5000
		}).done(function (data) {
			$('#builds ul').html('');
			var transitions = [];
			var statuses = { 'blue':0, 'blue_anime':0, 'red':0, 'red_anime':0, 'aborted':0, 'disabled':0, 'unknown':0};
			var activeJobs = [];

            var jobsHtml = '';
            var filteredJobsCount = 0; 
            
			$(data.jobs).each(function (index) {
            
                if(jobsToWatchRegex.test(this.name)) {               
                	if (_.contains(displayStatuses, this.color)) {
	                	var activeJob = { 
	                		name : this.name,
	                		statusColor : this.color,
	                		statusElementId : this.name.split('.').join('_') 
	                	};

	                	activeJobs.push(activeJob);

	                    jobsHtml += '<li id=\'' + activeJob.statusElementId + '\' class=\'' + activeJob.statusColor + '\'>' + activeJob.name + '</li>';
                	}  
                                                                                
                    if (lastData) {
                        var transition = transitionFor(this.color, lastData.jobs[index]);
                        if (transition)
                            transitions.push(transition);
                    }
                    
                    if (!statuses[this.color])
                        statuses[this.color] = 0;
                    statuses[this.color]++;
                    
                    filteredJobsCount++;
                }
			});
			
			$(transitions).each(function() {
				$('audio#'+this)[0].play();
			});
									
			$('body').attr('class', overallStatus(filteredJobsCount, statuses));
			lastData = data;
            
            $('#builds ul').append(jobsHtml);
            
            $(activeJobs).each(function() {
            	var activeJob = this;
           		if (_.has(buildBranches, activeJob.statusElementId)) {
        			appendBranchDetails(activeJob.statusElementId, buildBranches[activeJob.statusElementId]);	
        		} else {
	                $.ajax({
						url: 'http://'+ buildServerDomain +'/job/' + activeJob.name + '/api/json?format=json&pretty=true&jsonp=?',
	                    dataType: 'jsonp',
						timeout: 5000
	                }).done(function(data){
	                	var lastBuildUrl = data.builds[0].url + '/api/json?format=json&pretty=true&jsonp=?';
	                    $.ajax({
							url: lastBuildUrl,
	                        dataType: 'jsonp',
							timeout: 5000
	                    }).done(function(data){
	                    	var cause = data.actions[0].causes[0];
	                    	if(cause.upstreamBuild) {
			                	var upstreamBuildUrl = 'http://' + buildServerDomain + '/' + cause.upstreamUrl + cause.upstreamBuild + '/api/json?format=json&pretty=true&jsonp=?';
			                    $.ajax({
									url: upstreamBuildUrl,
			                        dataType: 'jsonp',
									timeout: 5000
			                    }).done(function(data){
			                    	appendBranchDetails(activeJob.statusElementId, data.actions[2].lastBuiltRevision.branch[0]);
			                    	buildBranches[activeJob.statusElementId] = data.actions[2].lastBuiltRevision.branch[0];
			                    });
	                    	} else {
			                    appendBranchDetails(activeJob.statusElementId, data.actions[2].lastBuiltRevision.branch[0]);
		                    	buildBranches[activeJob.statusElementId] = data.actions[2].lastBuiltRevision.branch[0];
	                    	}
	                	});
                	});
				}
            });
		}).fail(function(jqXHR, textStatus) {
			$('#builds ul').html('<li class=\'red\'>Error contacting server</li>');
			$('body').attr('class', 'error');
		});
    }, 5000);
}); 	

function appendBranchDetails(statusElementId, branchDetails) {
	$('#' + statusElementId).after('<ul class=\'jobDetail\'><li>Triggered by change/push on :' + branchDetails.name + '</li></ul>');
};

function transitionFor(currentStatus, lastStatus) {
	if (lastStatus===undefined)
		return 'new';
	if (currentStatus=='blue' && lastStatus.color=='blue_anime')
		return 'successful';
	if (currentStatus=='blue' && lastStatus.color=='red_anime')
		return 'fixed';
	if (currentStatus=='red' && lastStatus.color=='blue_anime')
		return 'failed';
	if (currentStatus=='red' && lastStatus.color=='red_anime')
		return 'repeatedlyFailing';
	if (currentStatus.match(/_anime$/) && !lastStatus.color.match(/_anime$/))
		return 'started';
	return 'noChange';
}

function overallStatus(jobsCount, statuses) {				
    if (jobsCount > 0 && jobsCount - statuses['disabled'] == statuses['blue'] + statuses['blue_anime'])
        return 'blue';
    if (statuses['red'] > 0 || statuses['red_anime'] > 0 || statuses['aborted'] > 0 || statuses['aborted_anime'] > 0)
        return 'red';
                           
    return 'unknown';
}
