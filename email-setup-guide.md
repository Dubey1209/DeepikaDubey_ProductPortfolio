# EmailJS Setup Guide for Portfolio Lock

## 🎯 What This Does:
When visitors unlock your portfolio, their details (name, email, message) will be sent directly to your email: `deepikaeducation1209@gmail.com`

## 📧 Setup EmailJS (Free Service):

### Step 1: Create EmailJS Account
1. Go to [EmailJS.com](https://www.emailjs.com/)
2. Sign up for FREE account
3. Verify your email address

### Step 2: Create Email Service
1. Dashboard → Email Services → Add New Service
2. Choose **Gmail** (recommended)
3. Connect your Gmail account
4. Service will be created (copy the Service ID)

### Step 3: Create Email Template
1. Dashboard → Email Templates → Create New Template
2. Template Settings:
   - **Template Name**: Portfolio Visitor Notification
   - **To Email**: deepikaeducation1209@gmail.com
   - **Subject**: New Portfolio Visitor! 🎉

3. Template Content (copy-paste this):
```
Hello Deepika! 👋

You have a new visitor to your portfolio!

📋 Visitor Details:
• Name: {{name}}
• Email: {{email}}
• Message: {{message}}
• Time: {{timestamp}}
• Browser: {{user_agent}}

🎊 Someone is interested in your work! Consider reaching out to them.

Best regards,
Your Portfolio Bot 🤖
```

4. Save and copy the **Template ID**

### Step 4: Get Your User ID
1. Dashboard → Account → API Keys
2. Copy your **Public Key** (User ID)

### Step 5: Update JavaScript File
Open `portfolio-lock.js` and update these values:

```javascript
// Around line 85-95, find this section:
body: JSON.stringify({
  service_id: 'YOUR_SERVICE_ID_HERE', // ← Replace with your Service ID
  template_id: 'YOUR_TEMPLATE_ID_HERE', // ← Replace with your Template ID  
  user_id: 'YOUR_USER_ID_HERE', // ← Replace with your User ID
  template_params: {
    // ... rest stays the same
  }
})
```

## 🚀 Alternative: Formsp.io (Simpler Setup)

If EmailJS seems complex, use Formsp.io:

1. Go to [Formsp.io](https://formsp.io/)
2. Create FREE account
3. Create new form
4. Get your form endpoint URL
5. Update the `sendVisitorData` function in `portfolio-lock.js`:

```javascript
async sendVisitorData(name, email, message) {
  const data = {
    name: name,
    email: email,
    message: message || 'No message provided',
    _subject: 'New Portfolio Visitor! 🎉'
  };

  const response = await fetch('YOUR_FORMSP_ENDPOINT_URL', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  });

  return response;
}
```

## ✅ Testing:
1. Setup your chosen email service
2. Update the JavaScript file with your IDs
3. Open your portfolio in browser
4. Fill out the unlock form
5. Check your email for notification!

## 🔧 Troubleshooting:
- **Email not sending**: Check Service ID, Template ID, and User ID
- **CORS errors**: Make sure your domain is whitelisted in EmailJS
- **No email received**: Check spam folder
- **Form not working**: Open browser console (F12) for errors

## 🎉 Benefits:
- ✅ Get notified when someone visits your portfolio
- ✅ Collect potential leads for networking
- ✅ Professional first impression
- ✅ Track visitor engagement
- ✅ One-time unlock per session

Your portfolio lock system is now ready! 🚀
