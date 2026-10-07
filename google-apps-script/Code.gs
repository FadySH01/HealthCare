// Deploy from aerixcompany@gmail.com as a Web app: Execute as Me; access Anyone.
// Set AERIX_TOKEN in Project Settings > Script Properties before testing.
const AERIX_SENDER = 'aerixcompany@gmail.com';

function result_(ok) {
  return ContentService.createTextOutput(JSON.stringify({ ok: ok === true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty('AERIX_TOKEN');
    if (!expected || expected.length < 40 || request.token !== expected) return result_(false);
    if (Session.getEffectiveUser().getEmail().toLowerCase() !== AERIX_SENDER) return result_(false);
    if (request.action === 'check') return result_(true);
    if (request.action === 'welcome' &&
        typeof request.email === 'string' &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email) &&
        request.email.length <= 254) {
      const name = typeof request.name === 'string' ? request.name.replace(/[<>\r\n]/g, '').slice(0, 80) : '';
      MailApp.sendEmail({
        to: request.email,
        subject: 'Welcome to AERIX',
        body: 'Welcome to AERIX' + (name ? ', ' + name : '') + '! Your account is ready. Explore nearby care, prepare for a visit, and keep your health questions in one place. Map listings are not verified partners; please call to confirm details. AERIX provides general information and cannot replace medical care.',
        name: 'AERIX',
      });
      return result_(true);
    }
    if (request.action === 'emergency' && request.emergency && typeof request.emergency === 'object') {
      const a = request.emergency;
      const validText = (value, max) => typeof value === 'string' && value.length <= max && !/[<>\r\n]/.test(value);
      const situations = ['Sudden illness', 'Injury', 'Road incident', 'Other urgent concern'];
      const people = ['Myself', 'Someone with me', 'A family member'];
      const hasLocation = typeof a.latitude === 'number' && Number.isFinite(a.latitude) && Math.abs(a.latitude) <= 90 &&
        typeof a.longitude === 'number' && Number.isFinite(a.longitude) && Math.abs(a.longitude) <= 180;
      const noLocation = a.latitude === null && a.longitude === null;
      const hasPhoto = typeof a.photoBase64 === 'string' && a.photoBase64.length > 0;
      if (!situations.includes(a.situation) || !people.includes(a.person) ||
          !validText(a.note, 240) || (!hasLocation && !noLocation) ||
          (hasPhoto && (a.photoBase64.length > 520000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.photoBase64)))) return result_(false);
      const mapLink = hasLocation
        ? 'https://www.google.com/maps/search/?api=1&query=' + a.latitude + ',' + a.longitude
        : 'Location was not shared.';
      const attachments = hasPhoto
        ? [Utilities.newBlob(Utilities.base64Decode(a.photoBase64), 'image/jpeg', 'emergency-photo.jpg')]
        : [];
      const body = [
        'A user asked AERIX to forward this emergency contact alert.',
        'AERIX is not an emergency dispatch service. Contact local emergency services directly; this mailbox may not be monitored immediately.',
        '',
        'Situation: ' + a.situation,
        'For: ' + a.person,
        'Approximate location: ' + mapLink,
        a.note ? 'Note: ' + a.note : '',
        hasPhoto ? 'A user-selected photo is attached.' : 'No photo was attached.'
      ].filter(Boolean).join('\n');
      MailApp.sendEmail({
        to: AERIX_SENDER,
        subject: 'AERIX emergency contact alert',
        body: body,
        name: 'AERIX',
        attachments: attachments,
      });
      return result_(true);
    }
    if (request.action === 'signup' && request.signup && typeof request.signup === 'object') {
      const s = request.signup;
      if (typeof s.verifiedAt !== 'string' || s.verifiedAt.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(s.verifiedAt) || /[\r\n]/.test(s.verifiedAt)) return result_(false);
      MailApp.sendEmail({
        to: AERIX_SENDER,
        subject: 'A new AERIX account was verified',
        body: 'A new AERIX account completed email verification at ' + s.verifiedAt + '.\n\n' +
          'No account details, password, verification code, or health information is included. Sign in to the AERIX admin workspace to review accounts.',
        name: 'AERIX',
      });
      return result_(true);
    }
    if (request.action === 'appointment' && request.appointment && typeof request.appointment === 'object') {
      const a = request.appointment;
      const validText = (value, max) => typeof value === 'string' && value.length <= max && !/[<>\r\n]/.test(value);
      const validEmail = typeof a.patientEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.patientEmail) && a.patientEmail.length <= 254;
      if (!validText(a.facilityName, 120) || !validText(a.facilityLocation || '', 160) || !validText(a.patientName, 80) || !validEmail || !/^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ||
          !/^\d{2}:\d{2}$/.test(a.time || '') || !validText(a.timeZone, 80)) return result_(false);
      MailApp.sendEmail({
        to: AERIX_SENDER,
        subject: 'New AERIX appointment request',
        body: 'A new appointment request was submitted through AERIX. It is not confirmed until the hospital accepts it.\n\n' +
          'Hospital or clinic: ' + a.facilityName + '\n' +
          'Location: ' + (a.facilityLocation || 'Not provided') + '\n' +
          'Patient: ' + a.patientName + '\n' +
          'Patient email: ' + a.patientEmail + '\n' +
          'Requested date: ' + a.date + '\n' +
          'Requested time: ' + a.time + ' (' + a.timeZone + ')\n\n' +
          'No health details are included. Review the request in the AERIX workspace.',
        name: 'AERIX',
      });
      return result_(true);
    }
    if (request.action === 'order' && request.order && typeof request.order === 'object') {
      const o = request.order;
      const validText = (value, max) => typeof value === 'string' && value.length <= max && !/[<>\r\n]/.test(value);
      const validEmail = typeof o.patientEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.patientEmail) && o.patientEmail.length <= 254;
      const fulfillmentMethod = o.fulfillmentMethod === 'delivery' ? 'delivery' : 'pickup';
      if (!validText(o.pharmacyName, 120) || !validText(o.pharmacyLocation || '', 160) || !validText(o.patientName, 80) || !validEmail || !validText(o.productName, 120) ||
          !validText(o.deliveryArea || '', 100) || (fulfillmentMethod === 'delivery' && o.deliveryArea.length < 2) || !Number.isInteger(o.quantity) || o.quantity < 1 || o.quantity > 3 ||
          typeof o.createdAt !== 'string' || o.createdAt.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(o.createdAt)) return result_(false);
      MailApp.sendEmail({
        to: AERIX_SENDER,
        subject: 'New AERIX pharmacy collection request',
        body: 'A new pharmacy collection request was submitted through AERIX.\n\n' +
          'Pharmacy: ' + o.pharmacyName + '\n' +
          'Location: ' + (o.pharmacyLocation || 'Not provided') + '\n' +
          'Patient: ' + o.patientName + '\n' +
          'Patient email: ' + o.patientEmail + '\n' +
          'Item: ' + o.productName + '\n' +
          'Quantity: ' + o.quantity + '\n' +
          'Fulfilment: ' + (fulfillmentMethod === 'delivery' ? 'Delivery requested to ' + o.deliveryArea + ' (pharmacy must confirm availability and fee)' : 'Self pickup') + '\n' +
          'Requested at: ' + o.createdAt + '\n\n' +
          'No health details are included. Review the request in the AERIX workspace.',
        name: 'AERIX',
      });
      return result_(true);
    }
    if (request.action === 'application' && request.application && typeof request.application === 'object') {
      const a = request.application;
      const validEmail = typeof a.applicantEmail === 'string' &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.applicantEmail) && a.applicantEmail.length <= 254;
      const validText = (value, max) => typeof value === 'string' && value.length <= max && !/[\r\n]/.test(value);
      if (!validEmail || !validText(a.name, 120) || !['hospital', 'pharmacy'].includes(a.kind) ||
          !validText(a.city, 80) || !validText(a.region, 80) || !validText(a.country, 60) ||
          !validText(a.registration, 120)) return result_(false);
      MailApp.sendEmail({
        to: AERIX_SENDER,
        subject: 'New AERIX provider application',
        body: 'A new AERIX provider interest application needs review.\n\n' +
          'Facility: ' + a.name + '\n' +
          'Type: ' + a.kind + '\n' +
          'Location: ' + a.city + ', ' + a.region + ', ' + a.country + '\n' +
          'Registration reference supplied: ' + (a.registration || 'Not supplied') + '\n' +
          'Applicant account email: ' + a.applicantEmail + '\n\n' +
          'This is an unverified application. Review it in the AERIX admin workspace before activating any facility.',
        name: 'AERIX',
      });
      return result_(true);
    }
    if (request.action !== 'send' ||
        typeof request.email !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email) ||
        request.email.length > 254 ||
        !/^\d{6}$/.test(request.code || '')) return result_(false);

    MailApp.sendEmail({
      to: request.email,
      subject: 'Your AERIX verification code',
      body: 'Your AERIX verification code is ' + request.code +
        '. It expires in 10 minutes. Never share this code. If you did not request an account, ignore this email.',
      name: 'AERIX',
    });
    return result_(true);
  } catch (error) {
    return result_(false);
  }
}
