CREATE TABLE class_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    class_id INT NOT NULL,
    user_id INT NOT NULL,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (class_id, user_id) 
);