const openai = require('openai');
const OPENAI_API_KEY = env.OPENAI_API_KEY;



const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fileUpload = require('express-fileupload');




const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());



const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // This is also the default, can be omitted
});

app.post('/send-nutrition', async (req, res) => {
    const { organizedNutrition, productTitle, ingredients, servingsPerContainer, servingSize, userQuestion } = req.body;

    // Create a detailed description of the nutrition information
    const nutritionDetails = organizedNutrition.map(item => {
        const details = item.details.join(", ");
        return `${item.category}: ${details}`;
    }).join("; ");

    const summary = `The nutrition information for ${productTitle} is as follows: 
    - Serving Size: ${servingSize}
    - Servings Per Container: ${servingsPerContainer}
    - Nutrition Details: ${nutritionDetails}
    - Ingredients: ${ingredients}`;

    const prompt = "Based on the above product information, answer the following question:"

    const finalPrompt = summary + '\n' + prompt + '\n' + userQuestion;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // Adjust based on the model you'd like to use
            messages: [{
                role: "user",
                content: finalPrompt
              }],
            temperature: 0.5,
            max_tokens: 100,
        });
        console.log(finalPrompt + "\n");
        console.log(response.choices[0].message.content); // Log the AI's response
        res.json({ message: "Nutritional information received successfully", aiResponse: response.choices[0].message.content });
    } catch (error) {
        console.error("Error calling OpenAI:", error);
        res.status(500).json({ message: "Error processing nutritional information" });
    }
});



















//GPT INTEGRATION
// const openai = new openai({apiKey: OPENAI_API_KEY});

// app.post('/get-gpt-advice', async (req, res) => {
//   try {
//       const { prompt } = req.body;

//       const gptResponse = await openai.chat.completions.create({
//           model: "gpt-3.5-turbo",
//           messages: [{
//             role: "user",
//             content: prompt
//           }],
//           temperature: 0.5,
//           max_tokens: 100,
//       });

//       console.log("GPT Response: ", gptResponse.data.choices[0].text); // Log the response
//       res.json({ advice: gptResponse.data.choices[0].text });
//   } catch (error) {
//       console.error('Failed to fetch advice from OpenAI:', error);
//       res.status(500).send('Failed to fetch advice from OpenAI');
//   }
// });

//GPT INTEGRATION


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
    from: 'PawWatch_Alerts@mailslurp.mx',
    to: "christiantoleno@gmail.com", //to: email, // Use the email address from the request body
    subject: subject,
    text: "Your pet is being naughty!",
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
      res.status(200).json({ message: 'Email sent successfully to ', email });
    }
  });
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});