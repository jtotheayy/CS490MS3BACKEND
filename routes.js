//Jay Santamaria CS 490 02/08/2024
//Inidividual Project
// routes.js
const express = require('express');
const db = require('./db');

const router = express.Router();

//Gets first 20 movies, then updates on user input
router.get('/movies', async (req, res) => {
  try {
    let query = `
      SELECT film.*, 
             actor.first_name AS actor_first_name, 
             actor.last_name AS actor_last_name, 
             category.name AS film_genre 
      FROM film
      JOIN film_actor ON film.film_id = film_actor.film_id
      JOIN actor ON film_actor.actor_id = actor.actor_id
      JOIN film_category ON film.film_id = film_category.film_id
      JOIN category ON film_category.category_id = category.category_id
    `;

    const { name, actor, genre } = req.query;
    if (name) {
      query += ` WHERE film.title LIKE '%${name}%'`;
    } else if (actor) {
      query += ` WHERE actor.first_name LIKE '%${actor}%' OR actor.last_name LIKE '%${actor}%'`;
    } else if (genre) {
      query += ` WHERE category.name LIKE '%${genre}%'`;
    }
    
    query += ` LIMIT 20`;

    const [rows, fields] = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching movies:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/customers', async (req, res) => {
  try {
    const { first_name, last_name, customer_id, page, pageSize = 20 } = req.query;

    let query = `
      SELECT customer.*
      FROM customer
    `;

    if (first_name) {
      query += ` WHERE customer.first_name LIKE '%${first_name}%' OR customer.last_name LIKE '%${first_name}%'`;
    }

    if (last_name) {
      query += first_name ? ` AND customer.last_name LIKE '%${last_name}%'` : ` WHERE customer.last_name LIKE '%${last_name}%'`;
    }

    if (customer_id) {
      query += first_name || last_name ? ` AND customer.customer_id = ${customer_id}` : ` WHERE customer.customer_id = ${customer_id}`;
    }

    const offset = (!isNaN(page) && page > 0) ? (page - 1) * pageSize : 0; // Check if page is a valid number
    query += ` ORDER BY customer.customer_id LIMIT ${offset}, ${pageSize}`;

    const [rows, fields] = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



//adds a new customer
router.post('/customers', async (req, res) => {
  try {
    const { first_name, last_name, email,  store_id, customer_id } = req.body;

    if (!first_name || !last_name || !email  || !store_id || !customer_id) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const query = `
      INSERT INTO customer (first_name, last_name, email, address_id, store_id, customer_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result, fields] = await db.query(query, [first_name, last_name, email, 1, store_id, customer_id]);

    res.json({ customer_id: result.insertId });
  } catch (err) {
    console.error('Error adding customer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


//edit customer
router.put('/customers/:id', async (req, res) => {
  const customerId = req.params.id;
  const { first_name, last_name, email, active } = req.body;

  try {
    if (!first_name && !last_name && !email && active === undefined) {
      res.status(400).json({ error: 'No fields provided for update' });
      return;
    }

    const updateFields = [];
    const updateValues = [];

    if (first_name) {
      updateFields.push('first_name = ?');
      updateValues.push(first_name);
    }

    if (last_name) {
      updateFields.push('last_name = ?');
      updateValues.push(last_name);
    }

    if (email) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }

    if (email) {
      updateFields.push('active = ?');
      updateValues.push(active);
    }

    const updateQuery = `
      UPDATE customer
      SET ${updateFields.join(', ')}
      WHERE customer_id = ?
    `;

    const queryValues = [...updateValues, customerId];
    const [result, fields] = await db.query(updateQuery, queryValues);

    if (result.affectedRows > 0) {
      res.json({ success: true, message: 'Customer updated successfully' });
    } else {
      res.status(404).json({ error: 'Customer not found' });
    }
  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// delete customers
router.delete('/customers/:id', async (req, res) => {
  const customerId = req.params.id;

  try {
    await db.query('SET foreign_key_checks = 0');

    const deleteQuery = `
      DELETE FROM customer
      WHERE customer_id = ?
    `;
    const [result, fields] = await db.query(deleteQuery, [customerId]);

    await db.query('SET foreign_key_checks = 1');

    if (result.affectedRows > 0) {
      res.json({ success: true, message: 'Customer deleted successfully' });
    } else {
      res.status(404).json({ error: 'Customer not found' });
    }
  } catch (err) {
    console.error('Error deleting customer:', err);

    await db.query('SET foreign_key_checks = 1');

    res.status(500).json({ error: 'Internal server error' });
  }
});


//rental history of customer
router.get('/customers/:customer_id/rental-history', async (req, res) => {
  const customerId = req.params.customer_id;

  try {
const rentalQuery = `
  SELECT
    rental.rental_id,
    rental.return_date,
    film.title
  FROM rental
  JOIN inventory ON rental.inventory_id = inventory.inventory_id
  JOIN film ON inventory.film_id = film.film_id
  WHERE rental.customer_id = ?
`;


    const [rentalRows, rentalFields] = await db.query(rentalQuery, [customerId]);

    if (rentalRows.length === 0) {
      res.json({ error: 'No rental history found for the customer' });
      return;
    }

    const rentalHistory = rentalRows.map((rental) => ({
      rental_id: rental.rental_id,
      return_date: rental.return_date,
      title: rental.title,
    }));

    res.json(rentalHistory);
  } catch (err) {
    console.error('Error fetching rental history:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});






// Route to get top 5 movies
router.get('/topmovies', async (req, res) => {
  try {
    const query = `SELECT film.film_id, film.title, COUNT(rental_id) AS rental_count
    FROM rental
    JOIN inventory ON rental.inventory_id = inventory.inventory_id
    JOIN film ON inventory.film_id = film.film_id
    JOIN film_actor ON film.film_id = film_actor.film_id
    WHERE film_actor.actor_id = (
        SELECT actor_id
        FROM film_actor
        GROUP BY actor_id
        ORDER BY COUNT(film_id) DESC
        LIMIT 1
    )
    GROUP BY film.film_id, title
    ORDER BY rental_count DESC
    LIMIT 5;`
  
    const [rows, fields] = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching top movies:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get top 5 actors
router.get('/topactors', async (req, res) => {
  try {
    const query = `
    SELECT actor.actor_id, CONCAT(first_name, ' ', last_name) AS name, COUNT(rental_id) AS rental_count
    FROM rental
    JOIN inventory ON rental.inventory_id = inventory.inventory_id
    JOIN film ON inventory.film_id = film.film_id
    JOIN film_actor ON film.film_id = film_actor.film_id
    JOIN actor ON film_actor.actor_id = actor.actor_id
    GROUP BY actor.actor_id, name
    ORDER BY rental_count DESC
    LIMIT 5;
  `;

    const [rows, fields] = await db.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching top actors:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get movie details by ID

router.get('/movies/:id', async (req, res) => {
  const movieId = req.params.id;
  try {
    const query = `SELECT * FROM film WHERE film_id = ?`;
    const [rows, fields] = await db.query(query, [movieId]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Movie not found' });
    } else {
      res.json(rows[0]);
    }
  } catch (err) {
    console.error('Error fetching movie details:', err);
  }
});

// Route to get actor details by ID
router.get('/actors/:id', async (req, res) => {
  const actorId = req.params.id;
  try {
    const query = `
      SELECT film.film_id, film.title, category.name AS category, COUNT(rental.rental_id) AS rental_count
      FROM rental
      JOIN inventory ON rental.inventory_id = inventory.inventory_id
      JOIN film ON inventory.film_id = film.film_id
      JOIN film_category ON film.film_id = film_category.film_id
      JOIN category ON film_category.category_id = category.category_id
      JOIN film_actor ON film.film_id = film_actor.film_id
      WHERE film_actor.actor_id = ?
      GROUP BY film.film_id, film.title, category.name
      ORDER BY rental_count DESC
      LIMIT 5;
    `;
    const [rows, fields] = await db.query(query, [actorId]);
    console.log(rows); 

    if (rows.length === 0) {
      res.status(404).json({ error: 'Actor not found' });
    } else {
      res.json(rows); 
    }
  } catch (err) {
    console.error('Error fetching actor details:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to rent a movie to a customer
router.post('/rent/:movieId', async (req, res) => {
  const movieId = req.params.movieId;
  const { customerID } = req.body;

  try {
    // Check if the required fields are provided
    if (!customerID) {
      res.status(400).json({ error: 'Missing customer ID' });
      return;
    }

    // Insert a new rental record for the specified customer and movie
    const rentQuery = `
    INSERT INTO rental (rental_date, inventory_id, customer_id, staff_id)
    VALUES (NOW(), 
            (SELECT inventory_id FROM inventory WHERE film_id = ? LIMIT 1), 
            ?, 
            1);
    `;

    await db.query(rentQuery, [movieId, customerID]);

    res.json({ success: true, message: 'Movie rented successfully' });
  } catch (err) {
    console.error('Error renting movie:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/return/:rentalId', async (req, res) => {
  const rentalId = req.params.rentalId;

  try {
    // Update the return date for the specified rental
    const returnQuery = `
      UPDATE rental
      SET return_date = NOW()
      WHERE rental_id = ?
    `;

    const [result, fields] = await db.query(returnQuery, [rentalId]);

    // Check if the rental was found and return date updated
    if (result.affectedRows > 0) {
      res.json({ success: true, message: 'Movie returned successfully' });
    } else {
      res.status(404).json({ error: 'Rental not found' });
    }
  } catch (err) {
    console.error('Error returning movie:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;
