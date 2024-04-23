const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(fileUpload());

app.post('/send-email', (req, res) => {
  if (!req.files || !req.files.image) {
    return res.status(400).send('No file uploaded.');
  }

  const { email, subject } = req.body;
  const { image } = req.files;

  // Create a Nodemailer transporter
  const transporter = nodemailer.createTransport({
    host: 'mailslurp.mx',
    port: 2587,
    secure: false,
    auth: {
      user: '2Kuafd0bNeIReEvkpP9QtI6mRniNrmrn',
      pass: 'xetdZlxlOH2RqnHJRbHYBEbmYU7whGdy',
    },
  });

  // Create the email options
  const mailOptions = {
    from: '1ae3a7fb-5a57-40d7-8590-95a038fd587d@mailslurp.mx',
    to: "christiantoleno@gmail.com",
    subject: subject,
    text:"Your pet is being naughty!",
    attachments: [
      {
        filename: 'capture.png',
        content: image.data,
        contentType: image.mimetype,
      },
    ],
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ error: 'Error sending email' });
    } else {
      console.log('Email sent:', info.response);
      res.status(200).json({ message: 'Email sent successfully' });
    }
  });
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});