// <script src='https://code.jquery.com/jquery-3.2.1.slim.min.js'></script>
Y.on('domready', function () {

    Y.all('form').each(function (n) {
        // remove SQS form handler and get reference to form Id
        var onSubmitValue = n.getAttribute('onsubmit');
        var sqsFormId = onSubmitValue.match(/submit\('([^']*)',/)[1];

        n.setAttribute('onsubmit', '');

        n.on('submit', function (e) {
            e.preventDefault();

            Y.use('squarespace-form-submit', 'node', function (Y) {
                var formSubmit = new Y.Squarespace.FormSubmit({ formNode: n });
                var d = getFormData(formSubmit);
                var nappkin = new Nappkin(449);
                var reservation = {
                    name: "Willem",
                    date: new Date(2017, 11, 25, 20),
                    email: "wbison@attic.nl",
                    pax: 2,
                }
                nappkin.createNewReservation(reservation);

                /* 
                                    formSubmit._submitSuccess = function () {
                                        // Submit to sales force
                                        var nappkin = new Nappkin(449);
                                        var reservation = {
                                            name: "Willem",
                                            date: new Date(2017, 11, 25, 20),
                                            email: "wbison@attic.nl",
                                            pax: 2,
                                        }
                                        nappkin.createNewReservation()
                
                                        // Show message
                                        var formNode = this.get("formNode");
                                        var submitText = formNode.one(".form-submission-text").cloneNode(!0);
                                        var submitHtml = formNode.one(".form-submission-html").cloneNode(!0);
                                        var submitHtmlData = submitHtml.getData("submission-html");
                
                                        submitHtml.setHTML(submitHtmlData);
                                        submitHtml.removeClass("hidden");
                                        submitText.removeClass("hidden");
                                        formNode.empty();
                                        formNode.append(submitText).append(submitHtml);
                                    };
                 */
                formSubmit.submit(sqsFormId, sqsFormId);
            });
        });
    })
});


function getFormData(formSubmit) {
    var data = {};
    var firstNameInput = $('label:contains(First Name)~input');
    data["firstName"] = firstNameInput.value;
    // Not tested for more than one form on a page...
    Y.all('input,textarea,select,button').each(function (item) {
        var key = null;

        // var $element = $(this);

        // this builds an array of input name -> value entered
        // in the sqsp forms, fields outside of name and email
        // don't have names and instead use random YUI ids.
        // jquery is included to pull in some extra data for the
        // phone number fields.  you need to find the ids for your
        // extra form fields and add them to params above.

        if (item.get('name')) {
            key = item.get('name');

            // } else if ($element.attr('x-autocompletetype')) {
            //     key = $element.attr('x-autocompletetype');

        } else {
            key = item.get('id');
        }

        if (item.get('type') == 'checkbox') {
            if (item.get('checked')) {
                if (data[key]) {
                    data[key] = data[key] + ', ' + item.get('value')
                } else {
                    data[key] = item.get('value')
                }
            }
        } else {
            data[key] = item.get('value');
        }

    });

    console.log(data);
    return data;
}


var Nappkin = (function () {
    function Nappkin(id) {
        this.locationId = parseInt(id);
        this.api = "https://cellarapp.apphb.com/api/v1/";

        this.getAvailabilityForMonth = function (date, success, failure) {
            var end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
            var start = new Date(date.getFullYear(), date.getMonth(), 1);
            this.getAvailability(start, end, success, failure);
        };

        this.getAvailability = function (dateStart, dateEnd, success, failure) {

            if (!failure) {
                failure = function () { };
            }

            if (!this.locationId) {
                failure("Invalid locationId");
                return;
            }

            var xhr = new XMLHttpRequest();
            var s = dateStart.getFullYear() + "-" + (dateStart.getMonth() + 1) + "-" + (dateStart.getDate());
            var e = dateEnd.getFullYear() + "-" + (dateEnd.getMonth() + 1) + "-" + (dateEnd.getDate());
            var url = this.api + "reservationslotext?from=" + s + "&to=" + e + "&locationId=" + this.locationId;
            xhr.open('GET', encodeURI(url));
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.onload = function () {
                if (xhr.status === 200) {
                    if (success) {
                        var reservationObject = JSON.parse(xhr.responseText).result;
                        reservationObject.isClosedOnDay = function (day) {
                            if (day >= reservationObject.dates.length) { return true; }
                            var info = reservationObject.dates[day];
                            for (var s = 0; s < info.sections.length; s++) {
                                var section = info.sections[s];
                                if (section.slots && section.slots.length) { return false; }
                            }
                            return true;
                        };
                        reservationObject.isAvailableOnDay = function (day, pax, slot) {
                            if (day >= reservationObject.dates.length) { return false; }
                            var info = reservationObject.dates[day];
                            for (var s = 0; s < info.sections.length; s++) {
                                var section = info.sections[s];
                                if (!section.isClosed) {
                                    for (var o = 0; o < section.slots.length; o++) {
                                        if (!slot || slot === section.slots[o].start) {
                                            var available = section.slots[o].available;
                                            if (available >= pax) {
                                                return true;
                                            }
                                        }
                                    }
                                }
                            }
                            return false;
                        };
                        success(reservationObject);
                    }
                }
                else {
                    failure(xhr.status);
                }
            };
            xhr.send();
        };

        this.createNewReservation = function (reservation, success, failure) {

            if (!failure) {
                failure = function () { };
            }

            if (!this.locationId) {
                failure("Invalid locationId");
                return;
            }

            if (!reservation) {
                failure("Missing reservation");
                return;
            }

            if (!reservation.date || reservation.date < new Date()) {
                failure("Invalid date");
                return;
            }

            if (!reservation.firstName && !reservation.lastName) {
                failure("Missing name");
                return;
            }

            if (!reservation.email && !reservation.phone) {
                failure("Missing email and phone");
                return;
            }

            if (!reservation.pax || !parseInt(reservation.pax)) {
                failure("Missing number of guests");
                return;
            }

            var r = {
                name: reservation.name,
                firstName: reservation.firstName,
                lastName: reservation.lastName,
                email: reservation.email,
                phone: reservation.phone,
                countGuests: parseInt(reservation.pax),
                startsOn: reservation.date.getFullYear() + "-" + (reservation.date.getMonth() + 1) + "-" + (reservation.date.getDate()) + "T" + reservation.date.toTimeString().substr(0, 8),
                localTime: true,
                notes: reservation.notes,
                language: reservation.language || 'nl',
                mailingList: true,
                source: 0,
                locationId: this.locationId
            };

            var xhr = new XMLHttpRequest();
            var url = this.api + "reservation";
            xhr.open('POST', encodeURI(url));
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    if (success) {
                        success(xhr.responseText);
                    }
                }
                else {
                    failure(xhr.status);
                }
            };
            xhr.send(JSON.stringify(r));
        };
    }
    return Nappkin;
})();


