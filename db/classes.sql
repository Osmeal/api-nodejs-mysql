CREATE TABLE classes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    gym_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    instructor VARCHAR(100) NOT NULL,
    capacity INT NOT NULL,
    start_time DATETIME NOT NULL,
    finish_time DATETIME NOT NULL,
    photo VARCHAR(300) NOT NULL,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);
